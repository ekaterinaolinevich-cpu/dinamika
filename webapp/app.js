import { sparkline, mountChart, fmtNum, fmtDate } from './charts.js';

// SDK Telegram подключаем сами и не ждём дольше полутора секунд.
let tg = null;
let tgLoadStarted = false;

function loadTelegramSdk(timeout = 1500) {
  if (tgLoadStarted) return Promise.resolve(tg);
  tgLoadStarted = true;

  const inTelegram =
    Boolean(window.Telegram?.WebApp) ||
    typeof window.TelegramWebviewProxy !== 'undefined' ||
    /Telegram/i.test(navigator.userAgent || '');

  if (!inTelegram) {
    tg = window.Telegram?.WebApp || null;
    return Promise.resolve(tg);
  }

  return new Promise((resolve) => {
    const done = () => {
      tg = window.Telegram?.WebApp || null;
      resolve(tg);
    };
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = done;
    script.onerror = done;
    document.head.appendChild(script);
    setTimeout(done, timeout);
  });
}

const state = { data: null, pending: null, addTab: 'file', queue: [], search: '', filter: 'all', cleanup: null, ocr: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function plural(n, forms) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

const PANEL_TITLES = {
  cbc: 'Общий анализ крови', iron: 'Железо', biochem: 'Биохимия', lipids: 'Липиды',
  thyroid: 'Щитовидная железа', hormones: 'Гормоны', vitamins: 'Витамины',
  inflammation: 'Воспаление', electrolytes: 'Минералы',
};

const EVIDENCE_LABEL = { guideline: 'рекомендация', consensus: 'консенсус', practice: 'практика' };

function statusMeta(status) {
  switch (status) {
    case 'high': return { label: 'выше нормы', cls: 'high' };
    case 'low': return { label: 'ниже нормы', cls: 'low' };
    case 'borderline': return { label: 'на границе', cls: 'borderline' };
    case 'normal': return { label: 'в норме', cls: 'normal' };
    default: return { label: 'нет референса', cls: 'unknown' };
  }
}

function refLine({ low, high, open_low: openLow, open_high: openHigh }) {
  const hasLow = low !== null && low !== undefined && !openLow;
  const hasHigh = high !== null && high !== undefined && !openHigh;
  if (hasLow && hasHigh) return `норма ${fmtNum(low)}–${fmtNum(high)}`;
  if (hasHigh) return `норма < ${fmtNum(high)}`;
  if (hasLow) return `норма > ${fmtNum(low)}`;
  return 'без референса';
}

function rangeText(low, high, openLow, openHigh) {
  return refLine({ low, high, open_low: openLow, open_high: openHigh });
}

function seriesRefLine(series) {
  return refLine({
    low: series.latest.ref_low, high: series.latest.ref_high,
    open_low: series.latest.open_low, open_high: series.latest.open_high,
  });
}

function monthsBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return '';
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  const months = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24 * 30.4)));
  if (months < 12) return `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`;
  const years = Math.round(months / 12);
  return `${years} ${plural(years, ['год', 'года', 'лет'])}`;
}

function parseNum(raw) {
  if (raw === null || raw === undefined) return NaN;
  const normalized = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return NaN;
  return Number(normalized);
}

function rowStatus(row) {
  const value = parseNum(row.value);
  if (!Number.isFinite(value)) return 'unknown';
  const low = parseNum(row.eval_low ?? row.ref_low);
  const high = parseNum(row.eval_high ?? row.ref_high);
  const safeLow = Number.isFinite(low) ? low : null;
  const safeHigh = Number.isFinite(high) ? high : null;
  if (safeHigh !== null && value > safeHigh) return row.open_high ? 'normal' : 'high';
  if (safeLow !== null && value < safeLow) return row.open_low ? 'normal' : 'low';
  return 'normal';
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не получилось. Попробуй ещё раз.');
  return data;
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

function overlay(on, text = 'Читаю бланк…') {
  const el = $('#overlay');
  el.hidden = !on;
  if (on) $('#overlay-text').textContent = text;
}

function haptic(type = 'light') {
  try { tg?.HapticFeedback?.impactOccurred(type); } catch { /* пусто */ }
}

function askConfirm(message) {
  if (tg?.showConfirm) {
    return new Promise((resolve) => {
      try { tg.showConfirm(message, (confirmed) => resolve(Boolean(confirmed))); } catch { resolve(window.confirm(message)); }
    });
  }
  return Promise.resolve(window.confirm(message));
}

/* ---------- роутер ---------- */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (!parts.length) return { name: 'dashboard' };
  if (parts[0] === 'i') return { name: 'detail', key: decodeURIComponent(parts.slice(1).join('/')) };
  if (['dashboard', 'indicators', 'add', 'profile'].includes(parts[0])) return { name: parts[0], params };
  return { name: 'dashboard' };
}

function go(hash) {
  haptic();
  if (location.hash === hash) render();
  else location.hash = hash;
}

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>',
  indicators: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-6M22 19H2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  upload: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>',
  file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>',
};

function renderTopbar(route) {
  const topbar = $('#topbar');
  const name = state.data?.profile?.name || 'друг';
  const initials = (name || 'Д').trim().slice(0, 1).toUpperCase();

  if (route.name === 'dashboard') {
    topbar.hidden = true;
    topbar.innerHTML = '';
    return;
  }

  if (route.name === 'detail') {
    topbar.innerHTML = `<button class="back" data-action="back" aria-label="Назад">${ICONS.back}</button><div style="flex:1"></div>`;
    topbar.hidden = false;
    return;
  }

  const titles = {
    indicators: ['Показатели', `${state.data?.summary?.indicators || 0} ${plural(state.data?.summary?.indicators || 0, ['показатель', 'показателя', 'показателей'])}`],
    add: ['Новый анализ', state.pending ? 'Проверь распознанное' : 'PDF, фото, текст или вручную'],
    profile: ['Профиль', 'Настройки и данные'],
  };
  const [title, sub] = titles[route.name] || ['', ''];
  topbar.innerHTML = `
    <div>
      <div style="font-size:26px;font-weight:720;letter-spacing:-.03em;line-height:1.1">${esc(title)}</div>
      <div class="muted" style="font-size:14px;margin-top:3px">${esc(sub)}</div>
    </div>
    ${route.name === 'profile' ? `<div class="topbar__avatar" style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-weight:700;color:var(--accent-2);background:var(--accent-soft)">${esc(initials)}</div>` : ''}
  `;
  topbar.hidden = false;
}

function renderTabbar(route) {
  const active = route.name === 'detail' ? 'indicators' : route.name;
  $('#tabbar').innerHTML = `
    <button class="tab ${active === 'dashboard' ? 'is-active' : ''}" data-nav="dashboard">${ICONS.dashboard}<span>Дашборд</span></button>
    <button class="tab ${active === 'indicators' ? 'is-active' : ''}" data-nav="indicators">${ICONS.indicators}<span>Показатели</span></button>
    <button class="tab tab--add" data-nav="add" aria-label="Добавить анализ"><span class="tab__plus">${ICONS.plus}</span><span>Добавить</span></button>
    <button class="tab ${active === 'profile' ? 'is-active' : ''}" data-nav="profile">${ICONS.profile}<span>Профиль</span></button>
  `;
  $('#tabbar').hidden = false;
}

/* ---------- дашборд ---------- */

function alertCard(item) {
  const meta = statusMeta(item.status);
  return `<a class="alert-card alert-card--${meta.cls}" href="#/i/${encodeURIComponent(item.key)}">
    <div class="alert-card__name">${esc(item.short || item.name)}</div>
    <div class="alert-card__value"><b>${fmtNum(item.value)}</b><span>${esc(item.unit)}</span></div>
    <div class="pill pill--${meta.cls}">${meta.label}</div>
    <div class="alert-card__spark" data-spark="${esc(item.key)}"></div>
    <div class="alert-card__ref">${esc(refLine({ low: item.ref_low, high: item.ref_high, open_low: item.open_low, open_high: item.open_high }))}</div>
  </a>`;
}

function changesRow(item) {
  const arrow = item.delta > 0 ? '↑' : '↓';
  const tone = item.status === 'high' || item.status === 'low' ? 'down' : item.status_first && item.status_first !== 'normal' ? 'up' : 'flat';
  return `<a class="row" href="#/i/${encodeURIComponent(item.key)}">
    <div class="row__main">
      <div class="row__name">${esc(item.short || item.name)}</div>
      <div class="row__meta">${fmtNum(item.first)} → ${fmtNum(item.latest)} ${esc(item.unit)} · ${monthsBetween(item.first_date, item.taken_at)}</div>
    </div>
    <div class="row__spark" data-spark="${esc(item.key)}"></div>
    <span class="delta delta--${tone}">${arrow} ${fmtNum(Math.abs(item.delta))}</span>
  </a>`;
}

function panelCard(panel) {
  const label = panel.deviations ? `${panel.deviations} ${plural(panel.deviations, ['отклонение', 'отклонения', 'отклонений'])}` : 'всё в норме';
  return `<a class="panel" href="#/indicators?panel=${encodeURIComponent(panel.key)}">
    <span class="panel__emoji">${panel.emoji}</span>
    <span class="panel__title">${esc(panel.title)}</span>
    <span class="panel__meta">${panel.total} ${plural(panel.total, ['показатель', 'показателя', 'показателей'])}</span>
    <span class="panel__badge ${panel.deviations ? '' : 'panel__badge--calm'}">${label}</span>
  </a>`;
}

function emptyState() {
  return `<div class="empty" style="padding-top:64px">
    <div class="empty__icon">${ICONS.indicators}</div>
    <h2>Пока пусто</h2>
    <p>Загрузи первый бланк — соберу все показатели, покажу референсы и графики. Или посмотри, как это выглядит на демо.</p>
    <button class="btn btn--primary" data-action="add">＋ Добавить анализ</button>
    <button class="btn btn--soft" data-action="demo" style="margin-top:10px">Посмотреть на демо</button>
  </div>`;
}

function renderDashboard() {
  const d = state.data;
  if (!d || !d.summary.indicators) return emptyState();
  const s = d.summary;
  const firstName = (d.profile.name || '').trim();

  return `
    ${d.readonly ? `<div class="readonly-banner"><span class="readonly-banner__tag">Демо</span><span>Так выглядит дневник. Открой приложение в Telegram, чтобы вести свой.</span></div>` : ''}
    <div style="padding:14px 2px 2px">
      <div style="font-size:25px;font-weight:720;letter-spacing:-.03em;line-height:1.15">Привет${firstName ? `, ${esc(firstName)}` : ''} 👋</div>
      <div class="muted" style="font-size:14px;margin-top:4px">${s.labs} ${plural(s.labs, ['лаборатория', 'лаборатории', 'лабораторий'])} · ${s.documents} ${plural(s.documents, ['сдача', 'сдачи', 'сдач'])} — в одной картине</div>
      <button class="goal-chip" data-action="goal"><span>${d.profile.goalEmoji}</span><span>${esc(d.profile.goalTitle)}</span><span class="goal-chip__edit">сменить</span></button>
    </div>

    <section class="hero" style="margin-top:14px">
      <div class="hero__row"><span class="hero__label">Последняя сдача</span><span class="hero__date">${fmtDate(s.last_date)}</span></div>
      <div class="hero__stats">
        <div class="hero__stat"><b>${s.indicators}</b><span>показателей</span></div>
        <div class="hero__stat"><b>${s.documents}</b><span>${plural(s.documents, ['сдача', 'сдачи', 'сдач'])}</span></div>
        <div class="hero__stat"><b>${s.deviations}</b><span>вне нормы</span></div>
      </div>
      ${d.readonly ? '' : '<button class="btn btn--light" data-action="add">＋ Добавить анализ</button>'}
    </section>

    ${d.deviations.length
      ? `<section style="margin-top:22px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 2px 10px"><h2>Требует внимания</h2><span class="faint" style="font-size:13px">${d.deviations.length} ${plural(d.deviations.length, ['показатель', 'показателя', 'показателей'])}</span></div>
          <div class="hscroll">${d.deviations.map(alertCard).join('')}</div>
        </section>`
      : `<div class="card note note--good" style="margin-top:22px"><div class="note__title">✅ Все показатели в норме</div><p>Последняя сдача в пределах референсов. Динамику всё равно смотри: важно не только «норма», но и куда движется значение.</p></div>`}

    ${d.changes.length
      ? `<section style="margin-top:22px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 2px 10px"><h2>Главные изменения</h2><span class="faint" style="font-size:13px">за всё время</span></div>
          <div class="card list">${d.changes.map(changesRow).join('')}</div>
        </section>`
      : ''}

    <section style="margin-top:22px">
      <div style="padding:0 2px 10px"><h2>По системам</h2></div>
      <div class="panels">${d.panels.map(panelCard).join('')}</div>
    </section>

    <p class="disclaimer">Динамика — дневник наблюдений, а не диагноз. Референсы взяты из бланков лабораторий. Решения о лечении принимает врач.</p>
  `;
}

/* ---------- список показателей ---------- */

function renderIndicators() {
  const d = state.data;
  if (!d || !d.series.length) return emptyState();

  const panelFilter = parseRoute().params?.get('panel') || '';
  const counts = {
    all: d.series.length,
    dev: d.series.filter((s) => s.status === 'high' || s.status === 'low').length,
    bord: d.series.filter((s) => s.status === 'borderline').length,
  };

  return `
    <div class="search">
      <div class="search__wrap">
        <span class="search__icon">${ICONS.search}</span>
        <input class="input" id="search-input" placeholder="Найти показатель или панель" value="${esc(state.search)}" autocomplete="off" />
      </div>
    </div>
    <div class="chips" id="filter-chips">
      <button class="chip ${state.filter === 'all' && !panelFilter ? 'chip--active' : ''}" data-filter="all">Все <span class="chip__count">${counts.all}</span></button>
      <button class="chip ${state.filter === 'dev' ? 'chip--active' : ''}" data-filter="dev">Отклонения <span class="chip__count">${counts.dev}</span></button>
      <button class="chip ${state.filter === 'bord' ? 'chip--active' : ''}" data-filter="bord">На границе <span class="chip__count">${counts.bord}</span></button>
      ${panelFilter ? `<button class="chip chip--active" data-filter="panel">${esc(d.panels.find((p) => p.key === panelFilter)?.short || 'Панель')} ✕</button>` : ''}
    </div>
    <div id="ind-list"></div>
  `;
}

function renderIndicatorList() {
  const d = state.data;
  const panelFilter = parseRoute().params?.get('panel') || '';
  const query = state.search.trim().toLowerCase();

  let items = d.series;
  if (panelFilter) items = items.filter((s) => s.panel === panelFilter);
  if (state.filter === 'dev') items = items.filter((s) => s.status === 'high' || s.status === 'low');
  if (state.filter === 'bord') items = items.filter((s) => s.status === 'borderline');
  if (query) {
    items = items.filter((s) => s.name.toLowerCase().includes(query) || (s.unit || '').toLowerCase().includes(query) || (s.code || '').toLowerCase().includes(query));
  }

  const container = $('#ind-list');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="empty" style="padding:38px 20px"><h2 style="font-size:17px">Ничего не нашлось</h2><p>Попробуй другое название или сбрось фильтр.</p></div>';
    return;
  }

  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.panel)) groups.set(item.panel, []);
    groups.get(item.panel).push(item);
  }
  const panelMeta = Object.fromEntries(d.panels.map((p) => [p.key, p]));

  container.innerHTML = [...groups.entries()].map(([panelKey, list]) => {
    const meta = panelMeta[panelKey];
    return `<div>
      <div class="group__title">${meta ? esc(meta.emoji + ' ' + meta.short) : 'Прочее'}</div>
      <div class="card list">
        ${list.map((item) => {
          const m = statusMeta(item.status);
          return `<a class="row" href="#/i/${encodeURIComponent(item.key)}">
            <span class="dot dot--${m.cls}"></span>
            <div class="row__main">
              <div class="row__name">${esc(item.short || item.name)}</div>
              <div class="row__meta">${esc(seriesRefLine(item))}${item.count > 1 ? ` · ${item.count} изм.` : ''}</div>
            </div>
            ${item.count > 1 ? `<div class="row__spark" data-spark="${esc(item.key)}"></div>` : ''}
            <div class="row__value"><b>${fmtNum(item.latest.value)}</b><span>${esc(item.unit)}</span></div>
          </a>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

/* ---------- карточка показателя ---------- */

function refCard(series) {
  const ref = series.reference || {};
  const evidence = EVIDENCE_LABEL[ref.evidence] || null;
  const source = ref.source;
  const labHasValues = (ref.labLow !== null && ref.labLow !== undefined) || (ref.labHigh !== null && ref.labHigh !== undefined);
  const labDiffers = ref.fromRule && labHasValues && (ref.labLow !== ref.low || ref.labHigh !== ref.high);

  return `<div class="ref-card">
    <div class="ref-card__top">
      <span class="ref-card__range">${esc(rangeText(ref.low, ref.high, ref.openLow, ref.openHigh))}${series.unit ? ' ' + esc(series.unit) : ''}</span>
      <span class="ref-card__label">${esc(ref.label || 'стандартный референс')}</span>
    </div>
    ${evidence || source?.url
      ? `<div class="ref-card__meta">
          ${evidence ? `<span class="evidence evidence--${ref.evidence}">${evidence}</span>` : ''}
          ${source?.url ? `<a class="ref-card__source" href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)} ↗</a>` : ''}
        </div>`
      : ''}
    ${labDiffers ? `<div class="ref-card__lab">В бланке лаборатории: ${esc(rangeText(ref.labLow, ref.labHigh, false, false))}</div>` : ''}
    ${ref.note ? `<p class="ref-card__note">${esc(ref.note)}</p>` : ''}
  </div>`;
}

function renderDetail(key) {
  const series = state.data?.series.find((s) => s.key === key);
  if (!series) {
    return `<div class="empty"><h2>Показатель не найден</h2><p>Возможно, он удалён вместе с анализом.</p><button class="btn btn--soft" data-action="back">Назад</button></div>`;
  }

  const m = statusMeta(series.status);
  const latest = series.latest;
  const noteClass = series.status === 'high' || series.status === 'low' ? 'note--alert' : series.status === 'borderline' ? 'note--warn' : 'note--good';
  const statusText = series.status === 'high' ? series.high : series.status === 'low' ? series.low
    : series.status === 'borderline'
      ? 'Значение у самой границы нормы. Обычно это не болезнь, но стоит пересдать через пару недель и посмотреть на динамику.'
      : 'Значение в пределах референса. Смотри не только на «норму», но и на тренд — резкие сдвиги внутри нормы тоже бывают значимыми.';

  const history = [...series.points].reverse();

  return `
    <div class="detail-head">
      <h1>${esc(series.name)}</h1>
      <div class="detail-sub">
        <span>${esc(series.labs.join(' · ') || 'Лаборатория')}</span><span class="faint">·</span>
        <span>${series.count} ${plural(series.count, ['измерение', 'измерения', 'измерений'])}</span><span class="faint">·</span>
        <span>${monthsBetween(series.first.taken_at, latest.taken_at)}</span>
      </div>
    </div>

    <div class="value-big">
      <span class="value-big__num" style="color:${m.cls === 'high' || m.cls === 'low' ? 'var(--bad)' : 'var(--text)'}">${fmtNum(latest.value)}</span>
      <span class="value-big__unit">${esc(series.unit)}</span>
      <span class="pill pill--${m.cls}">${m.label}</span>
    </div>

    <div class="chart-card">
      <div class="chart" data-chart="${esc(series.key)}"></div>
      <div class="legend">
        <span class="legend__item"><i class="legend__line"></i> твои значения</span>
        <span class="legend__item"><i class="legend__swatch"></i> зона нормы</span>
        ${latest.status === 'high' || latest.status === 'low' ? '<span class="legend__item"><i class="legend__dot"></i> вне нормы</span>' : ''}
      </div>
    </div>

    ${refCard(series)}

    <div class="stats3">
      <div class="stat"><span>минимум</span><b>${fmtNum(series.min)}</b></div>
      <div class="stat"><span>среднее</span><b>${fmtNum(series.avg)}</b></div>
      <div class="stat"><span>максимум</span><b>${fmtNum(series.max)}</b></div>
    </div>

    ${series.about ? `<div class="card note"><div class="note__title">💡 Что это</div><p>${esc(series.about)}</p></div>` : ''}

    <div class="card note ${noteClass}">
      <div class="note__title">${m.cls === 'high' ? '↑ Выше нормы' : m.cls === 'low' ? '↓ Ниже нормы' : m.cls === 'borderline' ? '⚠ На границе' : '✓ В норме'}</div>
      <p>${esc(statusText)}</p>
    </div>

    <div style="margin-top:22px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 2px 10px"><h2>История</h2><span class="faint" style="font-size:13px">${series.labs.length} ${plural(series.labs.length, ['лаборатория', 'лаборатории', 'лабораторий'])}</span></div>
      <div class="card list">
        ${history.map((point, index) => {
          const prevPoint = history[index + 1];
          const pm = statusMeta(point.status);
          const diff = prevPoint ? point.value - prevPoint.value : null;
          return `<div class="row" style="cursor:default">
            <span class="dot dot--${pm.cls}"></span>
            <div class="row__main">
              <div class="row__name">${fmtDate(point.taken_at)}</div>
              <div class="row__meta">${esc(point.lab || 'Лаборатория')} · ${esc(refLine({ low: point.ref_low, high: point.ref_high, open_low: point.open_low, open_high: point.open_high }))}</div>
            </div>
            <div class="row__value"><b>${fmtNum(point.value)}</b><span>${esc(series.unit)}</span></div>
            ${diff !== null && diff !== 0 ? `<span class="delta delta--flat">${diff > 0 ? '+' : ''}${fmtNum(diff)}</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <p class="disclaimer">Границы нормы зависят от пола, возраста и цели — они подписаны в карточке выше, у каждой указан источник. Если в бланке лаборатории был свой диапазон, он показан рядом. Один показатель сам по себе не диагноз.</p>
  `;
}

/* ---------- добавление ---------- */

function renderQueue() {
  const count = state.queue.length;
  return `<div class="queue-head">${count} ${plural(count, ['файл', 'файла', 'файлов'])} — склею в один анализ</div>
    <div class="queue-grid">
      ${state.queue.map((item, index) => `<div class="queue-item">
        ${item.url ? `<img src="${item.url}" alt="" />` : '<span class="queue-item__file">PDF</span>'}
        <button class="queue-item__x" data-action="queue-remove" data-index="${index}" aria-label="Убрать">✕</button>
      </div>`).join('')}
    </div>
    <div class="queue-actions">
      <button class="btn btn--soft btn--sm" data-action="shoot">📷 Ещё фото</button>
      <button class="btn btn--soft btn--sm" data-action="pick">Из галереи</button>
    </div>
    <button class="btn btn--primary" style="margin-top:12px" data-action="queue-parse">Разобрать ${count} ${plural(count, ['файл', 'файла', 'файлов'])}</button>
    <p class="disclaimer">Проверь, что все страницы бланка на месте. Дубли показателей объединю, дату и лабораторию возьму из файлов.</p>`;
}

function renderAdd() {
  if (state.data?.readonly) {
    return `<div class="empty" style="padding-top:40px"><div class="empty__icon">🔒</div><h2>Это демо</h2><p>Загружать анализы можно в приложении внутри Telegram — там у тебя будет свой дневник и свои данные.</p></div>`;
  }
  if (state.pending) return renderReview();

  const tab = state.addTab;
  return `
    <div class="segmented">
      <button data-add-tab="file" class="${tab === 'file' ? 'is-active' : ''}">Файл</button>
      <button data-add-tab="text" class="${tab === 'text' ? 'is-active' : ''}">Текст</button>
      <button data-add-tab="manual" class="${tab === 'manual' ? 'is-active' : ''}">Вручную</button>
    </div>

    ${tab === 'file' ? (state.queue.length ? renderQueue() : `
      <button class="btn btn--primary" data-action="shoot">📷 Снять фото бланка</button>
      <div class="dropzone dropzone--pick" id="dropzone" data-action="pick">
        <div class="dropzone__icon">${ICONS.upload}</div>
        <div class="dropzone__title">Или выбери файлы</div>
        <div class="dropzone__hint">PDF, фото или скриншот — можно несколько сразу<br><span class="dropzone__drag">или перетащи сюда</span></div>
      </div>
      <ul class="upload-tips">
        <li>Пойму таблицы Инвитро, Гемотест, Хеликс, CMD, Ситилаб</li>
        <li>Сфоткай несколько страниц — склею в один анализ</li>
        <li>${state.ocr ? 'Фото читаю через Apple Vision: нужен резкий снимок без бликов' : 'Фото на этом сервере не читаются — пришли PDF или вставь текст'}</li>
        <li>Референсы возьму прямо из бланка</li>
      </ul>`) : ''}

    ${tab === 'text' ? `<textarea class="textarea" id="text-input" placeholder="Вставь сюда текст бланка — строки вида&#10;&#10;Гемоглобин 118 г/л 120 - 150&#10;Ферритин 12 нг/мл 15 - 150"></textarea>
      <button class="btn btn--primary" style="margin-top:12px" data-action="parse-text">Разобрать текст</button>` : ''}

    ${tab === 'manual' ? `<div class="card note" style="margin-top:0"><div class="note__title">✍️ Ввести самому</div><p>Пригодится, если бланк на руках или пришёл картинкой. Добавь строки, впиши значения — референс можно оставить пустым, подставлю ориентировочный.</p></div>
      <button class="btn btn--primary" style="margin-top:12px" data-action="manual-start">Создать таблицу</button>` : ''}

    <p class="disclaimer">Файлы уходят только на твой сервер. Фото распознаются локально через Apple Vision — если снимок нечитаемый, вставь текст или введи значения вручную.</p>
  `;
}

function catalogOptions() {
  const catalog = state.data?.catalog || [];
  const groups = new Map();
  for (const item of catalog) {
    if (!groups.has(item.panel)) groups.set(item.panel, []);
    groups.get(item.panel).push(item);
  }
  return [...groups.entries()].map(([panel, items]) =>
    `<optgroup label="${esc(PANEL_TITLES[panel] || panel)}">${items.map((item) => `<option value="${item.code}">${esc(item.name)} (${esc(item.unit)})</option>`).join('')}</optgroup>`).join('');
}

function renderReview() {
  const pending = state.pending;
  const results = pending.results;
  const options = catalogOptions();
  const filled = results.filter((r) => r.name.trim() && Number.isFinite(parseNum(r.value)));
  const statuses = filled.map(rowStatus);
  const deviations = statuses.filter((s) => s === 'high' || s === 'low').length;
  const borderline = statuses.filter((s) => s === 'borderline').length;

  return `
    <div class="review-head">
      <div style="min-width:0">
        <div style="font-size:17px;font-weight:680;letter-spacing:-.02em">Проверь, что распозналось</div>
        <div class="muted" style="font-size:12.5px;margin-top:2px">Поправь любое поле, если что-то не так</div>
      </div>
      <span class="badge-soft">${filled.length} шт.</span>
    </div>

    <div class="field-row">
      <div class="field"><label class="field__label">Лаборатория</label>
        <input class="input" data-field="lab" value="${esc(pending.lab || '')}" placeholder="Например, Инвитро" /></div>
      <div class="field"><label class="field__label">Дата сдачи</label>
        <input class="input" type="date" data-field="taken_at" value="${esc(pending.taken_at || '')}" /></div>
    </div>

    ${pending.files?.length > 1 ? `<div class="files-note">
      ${pending.files.some((file) => file.thumb) ? `<div class="files-thumbs">${pending.files.map((file) => (file.thumb ? `<img src="${file.thumb}" alt="" />` : '<span class="files-thumb-file">PDF</span>')).join('')}</div>` : ''}
      <span>📎 ${pending.files.length} ${plural(pending.files.length, ['файл', 'файла', 'файлов'])}: ${pending.files.map((file) => esc(file.name)).join(', ')}</span>
    </div>` : ''}

    ${pending.dates?.length > 1 ? `<div class="files-note files-note--warn">⚠️ В файлах разные даты: ${pending.dates.map((date) => fmtDate(date)).join(', ')}. Проверь дату сдачи — сохраню всё одной сдачей.</div>` : ''}

    ${filled.length ? `<div class="muted" style="font-size:12.5px;margin:0 2px 10px">
      ${deviations ? `<span style="color:var(--bad);font-weight:600">${deviations} вне нормы</span>` : '<span style="color:var(--good);font-weight:600">все в норме</span>'}
      ${borderline ? ` · ${borderline} на границе` : ''}
    </div>` : ''}

    <div class="card review-card">
      <div id="review-body">
        ${results.map((r, index) => `
          <div class="review-row ${r.skip ? 'is-excluded' : ''} ${r.matched === false && r.code === null ? 'is-unmatched' : ''}" data-row="${index}">
            <div class="review-row__head">
              <input class="input input--name" data-index="${index}" data-field="name" value="${esc(r.name || '')}" placeholder="Название показателя" />
              <button class="icon-btn" data-action="remove-row" data-index="${index}" aria-label="Удалить строку">✕</button>
            </div>
            <div class="review-row__fields">
              <label class="rcell"><span>значение</span><input class="input" data-index="${index}" data-field="value" value="${esc(r.value ?? '')}" inputmode="decimal" placeholder="—" /></label>
              <label class="rcell"><span>ед.</span><input class="input" data-index="${index}" data-field="unit" value="${esc(r.unit || '')}" placeholder="—" /></label>
              <label class="rcell"><span>от</span><input class="input" data-index="${index}" data-field="ref_low" value="${esc(r.ref_low ?? '')}" inputmode="decimal" placeholder="—" /></label>
              <label class="rcell"><span>до</span><input class="input" data-index="${index}" data-field="ref_high" value="${esc(r.ref_high ?? '')}" inputmode="decimal" placeholder="—" /></label>
            </div>
            ${r.ref_from_rule && (r.eval_low !== r.ref_low || r.eval_high !== r.ref_high) ? `<div class="review-hint">Оценка по профилю: ${esc(rangeText(r.eval_low, r.eval_high, r.open_low, r.open_high))}</div>` : ''}
            ${!r.code ? `<div class="review-row__map">
              <select class="input select" data-index="${index}" data-field="code">
                <option value="">Не распознано — выбери показатель</option>
                ${options}
              </select>
            </div>` : ''}
          </div>`).join('')}
      </div>
    </div>

    <button class="btn btn--ghost btn--sm" style="width:100%;margin-top:10px" data-action="add-row">＋ Добавить строку</button>

    <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:16px">
      <button class="btn btn--soft" data-action="cancel-pending">Отмена</button>
      <button class="btn btn--primary" data-action="save" ${filled.length ? '' : 'disabled'}>Сохранить ${filled.length || ''}</button>
    </div>

    <p class="disclaimer">Проверь единицы и референсы: у некоторых лабораторий они отличаются, а от этого зависит оценка «норма / не норма».</p>
  `;
}

/* ---------- профиль ---------- */

function renderProfile() {
  const d = state.data;
  const p = d.profile;
  const initials = (p.name || 'Д').trim().slice(0, 1).toUpperCase();

  return `
    <div class="card profile-card" style="margin-top:8px">
      <div class="avatar-lg">${esc(initials)}</div>
      <div style="min-width:0">
        <div style="font-size:17px;font-weight:660">${esc(p.name || 'Без имени')}</div>
        <div class="muted" style="font-size:13px">${d.stats.results} значений · ${d.stats.documents} ${plural(d.stats.documents, ['анализ', 'анализа', 'анализов'])} · ${d.stats.labs} ${plural(d.stats.labs, ['лаборатория', 'лаборатории', 'лабораторий'])}</div>
      </div>
    </div>

    <div style="margin-top:22px">
      <div style="padding:0 2px 10px"><h2>Референсы под меня</h2></div>
      <div class="card">
        <div class="settings-row">
          <div>
            <div class="settings-row__label">Год рождения</div>
            <div class="settings-row__hint">${p.age ? `${p.age} лет — учитываю возрастные диапазоны` : 'Добавь, чтобы учитывать возрастные диапазоны'}</div>
          </div>
          <input class="input input--year" id="birth-year" type="number" inputmode="numeric" min="1920" max="${new Date().getFullYear()}" value="${p.birth_year || ''}" placeholder="1996" />
        </div>
      </div>
    </div>

    <div style="margin-top:22px">
      <div style="padding:0 2px 10px"><h2>Цель</h2></div>
      <div class="goal-list">
        ${(p.goals || []).map((goal) => `<button class="goal ${goal.key === p.goal ? 'is-active' : ''}" data-goal="${goal.key}">
          <span class="goal__emoji">${goal.emoji}</span>
          <span class="goal__body"><span class="goal__title">${esc(goal.title)}</span><span class="goal__desc">${esc(goal.description)}</span></span>
          <span class="goal__check">${goal.key === p.goal ? '✓' : ''}</span>
        </button>`).join('')}
      </div>
      <p class="disclaimer">Цель меняет границы оценки, а не сами анализы. Источник каждой границы видно в карточке показателя.</p>
    </div>

    <div style="margin-top:22px">
      <div style="padding:0 2px 10px"><h2>Настройки</h2></div>
      <div class="card">
        <div class="settings-row">
          <div><div class="settings-row__label">Пол</div><div class="settings-row__hint">Влияет на референсы, если в бланке их нет</div></div>
          <div class="switch-group">
            <button data-sex="female" class="${p.sex !== 'male' ? 'is-active' : ''}">Ж</button>
            <button data-sex="male" class="${p.sex === 'male' ? 'is-active' : ''}">М</button>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-row__label">Экспорт</div><div class="settings-row__hint">CSV со всеми значениями и референсами</div></div>
          <button class="btn btn--soft btn--sm" data-action="export">Скачать</button>
        </div>
      </div>
    </div>

    <div style="margin-top:22px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 2px 10px"><h2>Мои анализы</h2><span class="faint" style="font-size:13px">${d.documents.length}</span></div>
      ${d.documents.length ? `<div class="card list">
        ${d.documents.map((doc) => `<div class="doc-row">
          <div class="doc-ico">${ICONS.file}</div>
          <div class="row__main">
            <div class="row__name">${esc(doc.lab || 'Лаборатория')} · ${fmtDate(doc.taken_at)}</div>
            <div class="row__meta">${doc.results_count} ${plural(doc.results_count, ['показатель', 'показателя', 'показателей'])}${doc.filename ? ` · ${esc(doc.filename)}` : ''}</div>
          </div>
          <button class="icon-btn" data-action="delete-doc" data-id="${doc.id}" aria-label="Удалить">✕</button>
        </div>`).join('')}
      </div>` : '<div class="card note"><p>Пока нет ни одного анализа.</p></div>'}
    </div>

    <div style="margin-top:22px">
      <div style="padding:0 2px 10px"><h2>Ещё</h2></div>
      <div class="card list">
        <button class="settings-row" style="width:100%;background:none;border:none;text-align:left;cursor:pointer" data-action="demo">
          <div><div class="settings-row__label">Загрузить демо-данные</div><div class="settings-row__hint">5 анализов из двух лабораторий за год</div></div>
          <span class="faint">→</span>
        </button>
      </div>
    </div>

    <p class="disclaimer">Динамика не ставит диагнозы и не заменяет врача. Референсные значения берутся из бланка лаборатории; если их нет — из справочника. Версия 1.0.</p>
  `;
}

/* ---------- рендер ---------- */

function mountDropzone() {
  const zone = document.getElementById('dropzone');
  if (!zone) return;
  const highlight = (event) => { event.preventDefault(); zone.classList.add('is-over'); };
  const calm = () => zone.classList.remove('is-over');
  zone.addEventListener('dragover', highlight);
  zone.addEventListener('dragleave', calm);
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    calm();
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) addToQueue(files);
  });
}

function mountCharts(route) {
  state.cleanup?.();
  state.cleanup = null;

  $$('[data-spark]').forEach((el) => {
    const series = state.data?.series.find((s) => s.key === el.dataset.spark);
    if (series) el.innerHTML = sparkline(series.points, { width: 66, height: 26 });
  });

  if (route.name === 'detail') {
    const el = $('[data-chart]');
    const series = state.data?.series.find((s) => s.key === route.key);
    if (el && series) state.cleanup = mountChart(el, series);
  }
}

function render() {
  if (!state.data) return;

  const route = parseRoute();
  const view = $('#view');
  renderTabbar(route);
  renderTopbar(route);

  if (route.name === 'dashboard') view.innerHTML = renderDashboard();
  else if (route.name === 'indicators') { view.innerHTML = renderIndicators(); renderIndicatorList(); }
  else if (route.name === 'detail') view.innerHTML = renderDetail(route.key);
  else if (route.name === 'add') view.innerHTML = renderAdd();
  else if (route.name === 'profile') view.innerHTML = renderProfile();

  mountCharts(route);
  if (route.name === 'add') mountDropzone();

  if (route.name === 'indicators') {
    const input = $('#search-input');
    if (input) input.addEventListener('input', (event) => { state.search = event.target.value; renderIndicatorList(); mountCharts(route); });
  }

  document.body.classList.toggle('kb-open', Boolean(window.__keyboardOpen));

  if (tg?.BackButton) {
    if (route.name === 'detail' || (route.name === 'add' && state.pending)) tg.BackButton.show();
    else tg.BackButton.hide();
  }

  try {
    if (state.pending || state.queue.length) tg?.enableClosingConfirmation?.();
    else tg?.disableClosingConfirmation?.();
  } catch { /* старые клиенты */ }

  document.title = route.name === 'detail' ? `${state.data.series.find((s) => s.key === route.key)?.name || 'Показатель'} — Динамика` : 'Динамика — анализы в одном месте';
}

/* ---------- загрузка ---------- */

function newPending({ lab = '', taken_at = null, filename = null, source = 'manual', results = [], files = [], dates = [] }) {
  return {
    lab: lab === 'Лаборатория' ? '' : lab,
    taken_at: taken_at || new Date().toISOString().slice(0, 10),
    filename, source, files, dates,
    results: results.map((r) => ({
      code: r.code ?? null, name: r.name || '', raw_name: r.raw_name || r.name || '',
      value: r.value ?? '', unit: r.unit || '',
      ref_low: r.ref_low ?? '', ref_high: r.ref_high ?? '',
      eval_low: r.eval_low ?? null, eval_high: r.eval_high ?? null,
      ref_from_rule: Boolean(r.ref_from_rule),
      ref_text: r.ref_text || null,
      open_low: Boolean(r.open_low), open_high: Boolean(r.open_high),
      matched: r.matched !== false, skip: false,
    })),
  };
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith('image/'));
}

async function compressImage(file, maxSide = 2200, quality = 0.85) {
  if (!isImageFile(file)) return file;
  try {
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { bitmap = await createImageBitmap(file); }

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2.5 * 1024 * 1024) { bitmap.close?.(); return file; }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function revokeQueue() {
  for (const item of state.queue) if (item.url) URL.revokeObjectURL(item.url);
}

function addToQueue(files) {
  state.queue.push(...[...files].map((file) => ({ file, url: isImageFile(file) ? URL.createObjectURL(file) : null })));
  render();
}

function shootPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'environment');
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files?.[0];
    input.remove();
    if (file) addToQueue([file]);
  };
  input.click();
}

function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.txt,.csv,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,text/plain,image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = () => {
    const files = [...(input.files || [])];
    input.remove();
    if (files.length) addToQueue(files);
  };
  input.click();
}

async function uploadOne(file) {
  const response = await fetch(`/api/ingest?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', ...(tg?.initData ? { 'X-Telegram-Init-Data': tg.initData } : {}) },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось разобрать файл');
  return data;
}

function mergeFiles(list) {
  const results = [];
  const byKey = new Map();
  const labs = new Map();
  const dates = [];
  const files = [];

  for (const item of list) {
    if (item.lab && item.lab !== 'Лаборатория') labs.set(item.lab, (labs.get(item.lab) || 0) + 1);
    if (item.taken_at) dates.push(item.taken_at);
    files.push({ name: item.filename, count: item.results.length, thumb: item.thumb || null });

    for (const row of item.results) {
      const key = row.code || String(row.name || '').toLowerCase().trim();
      if (key && byKey.has(key)) {
        const existing = results[byKey.get(key)];
        if ((existing.ref_low === null || existing.ref_low === undefined) && row.ref_low !== null) {
          existing.ref_low = row.ref_low;
          existing.ref_high = row.ref_high;
        }
        continue;
      }
      if (key) byKey.set(key, results.length);
      results.push({ ...row });
    }
  }

  const lab = [...labs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const uniqueDates = [...new Set(dates)];
  return { lab, taken_at: uniqueDates.sort().at(-1) || null, results, files, dates: uniqueDates };
}

async function uploadFiles(files) {
  if (!files.length) return;

  const parsed = [];
  const errors = [];
  const total = files.length;

  for (let index = 0; index < files.length; index += 1) {
    overlay(true, total > 1 ? `Читаю ${index + 1} из ${total}…` : 'Читаю бланк…');
    const file = files[index];

    if (file.size > 25 * 1024 * 1024) { errors.push(`${file.name}: больше 25 МБ`); continue; }

    try {
      const prepared = await compressImage(file);
      const thumb = isImageFile(prepared) ? URL.createObjectURL(prepared) : null;
      const data = await uploadOne(prepared);
      if (!data.results?.length) { errors.push(`${file.name}: не нашла показателей`); continue; }
      parsed.push({ ...data, filename: prepared.name, thumb });
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  overlay(false);
  if (!parsed.length) { toast(errors[0] || 'Не удалось прочитать файлы'); return; }

  const merged = mergeFiles(parsed);
  revokeQueue();
  state.queue = [];
  state.pending = newPending({ lab: merged.lab, taken_at: merged.taken_at, filename: merged.files.map((f) => f.name).join(', '), source: 'upload', results: merged.results, files: merged.files, dates: merged.dates });
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const count = merged.results.length;
  toast(total > 1
    ? `Прочитала ${parsed.length} из ${total}: ${count} ${plural(count, ['показатель', 'показателя', 'показателей'])}`
    : `Распознала ${count} ${plural(count, ['показатель', 'показателя', 'показателей'])}`);
  if (errors.length) setTimeout(() => toast(errors[0]), 2800);
}

async function parseTextInput() {
  const text = $('#text-input')?.value || '';
  if (text.trim().length < 5) { toast('Вставь текст бланка'); return; }

  overlay(true, 'Разбираю текст…');
  try {
    const data = await api('/api/ingest/text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    });
    if (!data.results?.length) { overlay(false); toast('Не нашла строк с показателями. Проверь формат.'); return; }

    state.pending = newPending({ lab: data.lab, taken_at: data.taken_at, filename: 'Вставленный текст', source: 'text', results: data.results });
    overlay(false);
    render();
    toast(`Распознала ${data.results.length} ${plural(data.results.length, ['показатель', 'показателя', 'показателей'])}`);
  } catch (error) {
    overlay(false);
    toast(error.message);
  }
}

function startManual() {
  state.pending = newPending({
    results: [
      { name: '', value: '', unit: '', ref_low: '', ref_high: '' },
      { name: '', value: '', unit: '', ref_low: '', ref_high: '' },
      { name: '', value: '', unit: '', ref_low: '', ref_high: '' },
    ],
  });
  render();
}

async function savePending() {
  const pending = state.pending;
  if (!pending) return;

  const results = pending.results
    .filter((r) => !r.skip && r.name.trim() && Number.isFinite(parseNum(r.value)))
    .map((r) => ({
      code: r.code, name: r.name.trim(), raw_name: r.raw_name || r.name.trim(),
      value: parseNum(r.value), unit: r.unit.trim(),
      ref_low: Number.isFinite(parseNum(r.ref_low)) ? parseNum(r.ref_low) : null,
      ref_high: Number.isFinite(parseNum(r.ref_high)) ? parseNum(r.ref_high) : null,
      ref_text: r.ref_text,
    }));

  if (!results.length) { toast('Нет ни одной заполненной строки'); return; }

  overlay(true, 'Сохраняю…');
  try {
    const data = await api('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lab: pending.lab.trim() || 'Лаборатория', taken_at: pending.taken_at, filename: pending.filename, source: pending.source, results }),
    });
    state.data = data.state;
    state.pending = null;
    overlay(false);
    toast(`Сохранено: ${data.inserted} ${plural(data.inserted, ['показатель', 'показателя', 'показателей'])}`);
    go('#/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    overlay(false);
    toast(error.message);
  }
}

/* ---------- события ---------- */

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-nav]');
  if (nav) { go(`#/${nav.dataset.nav}`); return; }

  const chip = event.target.closest('[data-filter]');
  if (chip) {
    haptic('soft');
    const value = chip.dataset.filter;
    if (value === 'panel') { location.hash = '#/indicators'; render(); return; }
    state.filter = value;
    if (value === 'all') location.hash = '#/indicators';
    render();
    return;
  }

  const goalBtn = event.target.closest('[data-goal]');
  if (goalBtn) {
    haptic();
    try {
      const data = await api('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: goalBtn.dataset.goal }) });
      state.data = data;
      render();
      toast(`Цель: ${data.profile.goalTitle}`);
    } catch (error) { toast(error.message); }
    return;
  }

  const sexBtn = event.target.closest('[data-sex]');
  if (sexBtn) {
    haptic();
    try {
      const data = await api('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sex: sexBtn.dataset.sex }) });
      state.data = data;
      render();
    } catch (error) { toast(error.message); }
    return;
  }

  const tabBtn = event.target.closest('[data-add-tab]');
  if (tabBtn) { state.addTab = tabBtn.dataset.addTab; render(); return; }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'add') go('#/add');
  else if (action === 'shoot') shootPhoto();
  else if (action === 'queue-remove') {
    const index = Number(event.target.closest('[data-index]')?.dataset.index);
    if (Number.isInteger(index) && state.queue[index]) {
      if (state.queue[index].url) URL.revokeObjectURL(state.queue[index].url);
      state.queue.splice(index, 1);
      render();
    }
  } else if (action === 'queue-parse') {
    if (state.queue.length) uploadFiles(state.queue.map((item) => item.file));
  } else if (action === 'goal') go('#/profile');
  else if (action === 'back') {
    if (state.pending) {
      if (!(await askConfirm('Отменить разбор? Распознанные значения не сохранятся.'))) return;
      state.pending = null;
      render();
    } else if (history.length > 1) history.back();
    else go('#/dashboard');
  } else if (action === 'pick') pickFile();
  else if (action === 'parse-text') parseTextInput();
  else if (action === 'manual-start') startManual();
  else if (action === 'add-row') { state.pending?.results.push({ code: null, name: '', value: '', unit: '', ref_low: '', ref_high: '', skip: false }); render(); }
  else if (action === 'remove-row') {
    const index = Number(event.target.closest('[data-index]')?.dataset.index);
    if (Number.isInteger(index) && state.pending) { state.pending.results.splice(index, 1); render(); }
  } else if (action === 'cancel-pending') {
    if (!(await askConfirm('Отменить разбор? Распознанные значения не сохранятся.'))) return;
    state.pending = null;
    render();
  } else if (action === 'save') savePending();
  else if (action === 'export') window.location.href = '/api/export.csv';
  else if (action === 'demo') {
    if (!(await askConfirm('Загрузить демо-данные? Текущие анализы этого профиля будут заменены.'))) return;
    overlay(true, 'Загружаю демо…');
    try {
      const data = await api('/api/demo', { method: 'POST' });
      state.data = data.state;
      overlay(false);
      toast('Демо загружено');
      go('#/dashboard');
    } catch (error) { overlay(false); toast(error.message); }
  } else if (action === 'delete-doc') {
    const id = event.target.closest('[data-id]')?.dataset.id;
    if (!id || !(await askConfirm('Удалить этот анализ и все его показатели?'))) return;
    try {
      const data = await api(`/api/documents/${id}`, { method: 'DELETE' });
      state.data = data.state;
      render();
      toast('Удалено');
    } catch (error) { toast(error.message); }
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!state.pending || !target.dataset.field) return;
  if (target.dataset.index !== undefined) state.pending.results[Number(target.dataset.index)][target.dataset.field] = target.value;
  else state.pending[target.dataset.field] = target.value;
});

document.addEventListener('change', async (event) => {
  const target = event.target;

  if (target.id === 'birth-year') {
    const year = Number(target.value);
    if (!year || year < 1920 || year > new Date().getFullYear()) { toast('Год рождения выглядит странно'); return; }
    try {
      const data = await api('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birth_year: year }) });
      state.data = data;
      render();
      toast('Возрастные диапазоны включены');
    } catch (error) { toast(error.message); }
    return;
  }

  if (target.matches('select[data-field="code"]') && state.pending) {
    const index = Number(target.dataset.index);
    const code = target.value;
    const item = state.data?.catalog?.find((entry) => entry.code === code);
    state.pending.results[index].code = code || null;
    state.pending.results[index].matched = Boolean(code);
    if (item) state.pending.results[index].name = item.name;
    render();
  }
});

window.addEventListener('hashchange', () => { window.scrollTo({ top: 0 }); render(); });

/* ---------- телеграм ---------- */

function applyTheme() {
  const scheme = tg?.colorScheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.classList.toggle('tg-dark', scheme === 'dark');
}

function initTelegram() {
  if (!tg) return;
  try {
    tg.ready(); tg.expand();
    tg.setHeaderColor?.('secondary_bg_color');
    tg.setBackgroundColor?.('bg_color');
    applyTheme();
    tg.onEvent?.('themeChanged', applyTheme);
    tg.BackButton?.onClick(async () => {
      if (state.pending) {
        if (!(await askConfirm('Отменить разбор? Распознанные значения не сохранятся.'))) return;
        state.pending = null;
        render();
      } else history.back();
    });
  } catch { /* вне Telegram */ }
}

function watchKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    const open = window.innerHeight - viewport.height > 140;
    if (open !== window.__keyboardOpen) {
      window.__keyboardOpen = open;
      document.body.classList.toggle('kb-open', open);
    }
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
}

async function boot() {
  await loadTelegramSdk();
  initTelegram();
  applyTheme();
  watchKeyboard();

  try {
    const health = await fetch('/api/health').then((r) => r.json()).catch(() => ({}));
    state.ocr = Boolean(health.ocr);
  } catch { state.ocr = false; }

  try {
    state.data = await api('/api/state');
  } catch {
    toast('Нет связи с сервером');
    state.data = null;
  }

  if (!location.hash) location.hash = '#/dashboard';
  if (state.data) render();

  const bootEl = $('#boot');
  if (bootEl) bootEl.remove();
  $('#view').hidden = false;
}

boot();
