// Графики: SVG без зависимостей. Главное — честно показать зону референса.

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function fmtNum(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  const abs = Math.abs(num);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return num.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtDate(iso, { withYear = true } = {}) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return withYear ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

export function fmtMonth(iso) {
  const [y, m] = String(iso).split('-').map(Number);
  if (!y || !m) return iso;
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-6; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function scaleX(times) {
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (min === max) return () => 0.5;
  return (t) => (t - min) / (max - min);
}

const timeOf = (iso) => new Date(`${iso}T00:00:00`).getTime();
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function sparkline(points, { width = 66, height = 26 } = {}) {
  if (!points || !points.length) return '';

  const values = points.map((p) => p.value);
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const scale = scaleX(points.map((p) => timeOf(p.taken_at)));

  const coords = points.map((point) => ({
    x: pad + scale(timeOf(point.taken_at)) * (width - pad * 2),
    y: max === min ? height / 2 : pad + (1 - (point.value - min) / span) * (height - pad * 2),
  }));

  const last = points[points.length - 1];
  const color = last.status === 'high' || last.status === 'low' ? 'var(--bad)' : 'var(--accent)';
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const tip = coords[coords.length - 1];

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
    <circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="2.6" fill="${color}"/>
  </svg>`;
}

export function mountChart(container, series, { height = 216 } = {}) {
  if (!container || !series?.points?.length) return () => {};

  const render = () => {
    const width = Math.max(container.clientWidth || 320, 240);
    const points = series.points;
    const values = points.map((p) => p.value);

    const refLow = points[points.length - 1].ref_low;
    const refHigh = points[points.length - 1].ref_high;

    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (refLow !== null && refLow !== undefined) lo = Math.min(lo, refLow);
    if (refHigh !== null && refHigh !== undefined) hi = Math.max(hi, refHigh);

    const padY = (hi - lo || Math.abs(hi) || 1) * 0.16;
    const domainMin = lo - padY;
    const domainMax = hi + padY;

    const pad = { top: 18, right: 14, bottom: 26, left: 40 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const y = (value) => pad.top + (1 - (value - domainMin) / (domainMax - domainMin || 1)) * plotH;
    const times = points.map((p) => timeOf(p.taken_at));
    const sx = scaleX(times);
    const x = (index) => pad.left + (points.length === 1 ? 0.5 : sx(times[index])) * plotW;

    const ticks = niceTicks(domainMin, domainMax, 4).filter((t) => t >= domainMin && t <= domainMax);

    const clampY = (v) => Math.min(Math.max(v, pad.top), pad.top + plotH);
    const bandTop = refHigh !== null && refHigh !== undefined ? clampY(y(refHigh)) : pad.top;
    const bandBottom = refLow !== null && refLow !== undefined ? clampY(y(refLow)) : pad.top + plotH;
    const bandHeight = Math.max(bandBottom - bandTop, 2);
    const aboveH = refHigh !== null && refHigh !== undefined ? Math.max(bandTop - pad.top, 0) : 0;
    const belowY = refLow !== null && refLow !== undefined ? bandBottom : pad.top + plotH;
    const belowH = Math.max(pad.top + plotH - belowY, 0);

    const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;
    const gradientId = `g-${Math.random().toString(36).slice(2, 8)}`;

    const gridLines = ticks.map((tick) => `
      <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" stroke="var(--line-soft)" stroke-width="1"/>
      <text x="${pad.left - 8}" y="${(y(tick) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--faint)">${esc(fmtNum(tick))}</text>`).join('');

    const labelIndexes = points.length <= 2 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    const xLabels = [...new Set(labelIndexes)].map((index) => {
      const anchor = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
      const px = index === 0 ? x(index) + 2 : index === points.length - 1 ? x(index) - 2 : x(index);
      return `<text x="${px.toFixed(1)}" y="${height - 8}" text-anchor="${anchor}" font-size="10" fill="var(--faint)">${esc(fmtMonth(points[index].taken_at))}</text>`;
    }).join('');

    const dots = points.map((point, index) => {
      const isOut = point.status === 'high' || point.status === 'low';
      return `<circle class="pt" cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="4.2" fill="${isOut ? 'var(--bad)' : 'var(--accent)'}" stroke="var(--card)" stroke-width="2"/>`;
    }).join('');

    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="График показателя">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${aboveH > 1 ? `<rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${aboveH.toFixed(1)}" fill="var(--bad)" opacity="0.05"/>` : ''}
      ${belowH > 1 ? `<rect x="${pad.left}" y="${belowY.toFixed(1)}" width="${plotW}" height="${belowH.toFixed(1)}" fill="var(--bad)" opacity="0.05"/>` : ''}
      <rect x="${pad.left}" y="${bandTop.toFixed(1)}" width="${plotW}" height="${bandHeight.toFixed(1)}" fill="var(--good)" opacity="0.09" rx="3"/>
      ${gridLines}
      <path d="${areaPath}" fill="url(#${gradientId})"/>
      <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <line class="focus-line" x1="0" x2="0" y1="${pad.top}" y2="${pad.top + plotH}" stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
      <circle class="focus-dot" r="5.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2.5" opacity="0"/>
      ${dots}
      ${xLabels}
    </svg>
    <div class="chart-tip" style="opacity:0"></div>`;

    const svg = container.querySelector('svg');
    const tip = container.querySelector('.chart-tip');
    const focusLine = container.querySelector('.focus-line');
    const focusDot = container.querySelector('.focus-dot');

    const show = (index) => {
      const px = x(index);
      const py = y(points[index].value);
      const point = points[index];
      const statusText = point.status === 'high' ? 'выше нормы' : point.status === 'low' ? 'ниже нормы' : point.status === 'borderline' ? 'на границе' : 'в норме';

      focusLine.setAttribute('x1', px);
      focusLine.setAttribute('x2', px);
      focusLine.setAttribute('opacity', '0.55');
      focusDot.setAttribute('cx', px);
      focusDot.setAttribute('cy', py);
      focusDot.setAttribute('opacity', '1');
      focusDot.setAttribute('fill', point.status === 'high' || point.status === 'low' ? 'var(--bad)' : 'var(--accent)');

      tip.textContent = `${fmtDate(point.taken_at, { withYear: false })} · ${fmtNum(point.value)} ${series.unit || ''} · ${statusText}`;
      tip.style.left = `${(Math.min(Math.max(px, 62), width - 62) / width) * 100}%`;
      tip.style.top = `${Math.max(py - 10, 26)}px`;
      tip.style.opacity = '1';
    };

    const hide = () => {
      focusLine.setAttribute('opacity', '0');
      focusDot.setAttribute('opacity', '0');
      tip.style.opacity = '0';
    };

    const nearest = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const rel = ((clientX - rect.left) / rect.width) * width;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i += 1) {
        const dist = Math.abs(x(i) - rel);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      return best;
    };

    const onMove = (event) => show(nearest(event.clientX));
    const onLeave = () => hide();

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerdown', onMove);
    svg.addEventListener('pointerleave', onLeave);
    svg.addEventListener('pointerup', () => setTimeout(hide, 1800));

    return () => {
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerdown', onMove);
      svg.removeEventListener('pointerleave', onLeave);
    };
  };

  let cleanupInner = render();
  const observer = new ResizeObserver(() => {
    cleanupInner?.();
    cleanupInner = render();
  });
  observer.observe(container);

  return () => {
    observer.disconnect();
    cleanupInner?.();
  };
}
