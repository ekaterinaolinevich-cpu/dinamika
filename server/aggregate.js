// Ряды, статусы, изменения и сводка для интерфейса.

import { BY_CODE, PANELS, ORDER, INDICATORS, normalizeName } from './catalog.js';
import { resolveReference, SOURCES, GOALS } from './references.js';
import { allResults, listDocuments, getUser, stats } from './db.js';

export const BORDERLINE_SHARE = 0.05;

export function statusOf(value, range) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  const { low, high, openLow, openHigh } = range;

  if (!openHigh && value > high) return 'high';
  if (!openLow && value < low) return 'low';
  if (openLow && openHigh) return 'normal';

  const width = !openLow && !openHigh ? high - low : null;
  const pad = width ? width * BORDERLINE_SHARE : 0;

  if (width && pad > 0) {
    if ((!openHigh && value >= high - pad) || (!openLow && value <= low + pad)) return 'borderline';
  }

  return 'normal';
}

// Приоритет источника диапазона:
//   1) правило по цели / возрасту / полу;
//   2) бланк лаборатории;
//   3) базовый диапазон каталога.
export function resolveRange(row, indicator, profile = {}) {
  const code = indicator?.code || row.code || null;
  const resolved = code ? resolveReference(code, profile) : null;

  const labLow = row.ref_low === null || row.ref_low === undefined ? null : Number(row.ref_low);
  const labHigh = row.ref_high === null || row.ref_high === undefined ? null : Number(row.ref_high);
  const hasLab = labLow !== null || labHigh !== null;

  if (resolved?.ruleId) {
    return {
      low: resolved.low, high: resolved.high,
      openLow: Boolean(resolved.openLow), openHigh: Boolean(resolved.openHigh),
      labLow, labHigh, fromRule: true,
      label: resolved.label, note: resolved.note, evidence: resolved.evidence,
      source: resolved.source, ruleId: resolved.ruleId,
    };
  }

  if (hasLab) {
    return {
      low: labLow, high: labHigh,
      openLow: Boolean(indicator?.openLow) || labLow === null,
      openHigh: Boolean(indicator?.openHigh) || labHigh === null,
      labLow, labHigh, fromRule: false,
      label: 'референс из бланка', note: '', evidence: null, source: SOURCES.lab, ruleId: null,
    };
  }

  return {
    low: resolved?.low ?? null, high: resolved?.high ?? null,
    openLow: resolved ? Boolean(resolved.openLow) : true,
    openHigh: resolved ? Boolean(resolved.openHigh) : true,
    labLow, labHigh, fromRule: false,
    label: 'стандартный референс', note: '', evidence: null, source: null, ruleId: null,
  };
}

const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function scoreChange(from, to, rangeWidth) {
  if (!from || !to) return 0;
  const delta = Math.abs(to.value - from.value);
  if (!delta) return 0;

  const scale = rangeWidth && rangeWidth > 0 ? rangeWidth : Math.max(Math.abs(from.value), Math.abs(to.value), 1);

  let score = delta / scale;
  const crossed = from.status !== to.status;
  const outNow = to.status === 'high' || to.status === 'low';
  const bothNormal = from.status === 'normal' && to.status === 'normal';

  if (crossed) score += 0.5;
  if (outNow) score += 0.25;
  if (bothNormal) score *= 0.3;

  return score;
}

function buildSeries(results, profile) {
  const groups = new Map();

  for (const row of results) {
    const indicator = row.code ? BY_CODE.get(row.code) : null;
    const key = row.code || `raw:${normalizeName(row.raw_name || row.name)}`;
    if (!groups.has(key)) groups.set(key, { key, indicator, rows: [] });
    groups.get(key).rows.push(row);
  }

  const series = [];

  for (const [key, group] of groups) {
    const { indicator, rows } = group;
    const points = rows
      .map((row) => {
        const range = resolveRange(row, indicator, profile);
        const value = toNum(row.value);
        return {
          id: row.id,
          document_id: row.document_id,
          taken_at: row.taken_at,
          lab: row.lab,
          value,
          value_text: row.value_text || null,
          unit: row.unit || indicator?.unit || null,
          ref_low: range.low,
          ref_high: range.high,
          open_low: range.openLow,
          open_high: range.openHigh,
          ref_text: row.ref_text || null,
          lab_low: range.labLow,
          lab_high: range.labHigh,
          ref_label: range.label,
          ref_note: range.note,
          ref_source: range.source,
          ref_evidence: range.evidence,
          ref_from_rule: range.fromRule,
          status: statusOf(value, range),
        };
      })
      .filter((p) => p.value !== null && Number.isFinite(p.value))
      .sort((a, b) => (a.taken_at < b.taken_at ? -1 : a.taken_at > b.taken_at ? 1 : 0));

    if (!points.length) continue;

    const latest = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : null;
    const first = points[0];
    const values = points.map((p) => p.value);
    const delta = prev ? latest.value - prev.value : null;
    const deltaPct = prev && prev.value !== 0 ? (delta / prev.value) * 100 : null;
    const deltaFirst = prev ? latest.value - first.value : null;
    const deltaFirstPct = prev && first.value !== 0 ? (deltaFirst / first.value) * 100 : null;
    const rangeWidth = !latest.open_low && !latest.open_high ? latest.ref_high - latest.ref_low : null;

    series.push({
      key,
      code: indicator?.code || null,
      name: indicator?.name || latest.value_text || rows[0].raw_name || rows[0].name,
      short: indicator?.short || indicator?.name || latest.value_text || rows[0].raw_name || rows[0].name,
      unit: latest.unit || indicator?.unit || '',
      panel: indicator?.panel || 'other',
      matched: Boolean(indicator),
      about: indicator?.about || '',
      high: indicator?.high || '',
      low: indicator?.low || '',
      points,
      latest,
      prev,
      first,
      delta,
      deltaPct,
      deltaFirst,
      deltaFirstPct,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: points.length,
      labs: [...new Set(points.map((p) => p.lab).filter(Boolean))],
      significance: scoreChange(first, latest, rangeWidth),
      significanceFirst: scoreChange(first, latest, rangeWidth),
      status: latest.status,
      statusFirst: first.status,
      reference: {
        low: latest.ref_low, high: latest.ref_high,
        openLow: latest.open_low, openHigh: latest.open_high,
        label: latest.ref_label, note: latest.ref_note,
        source: latest.ref_source, evidence: latest.ref_evidence,
        fromRule: latest.ref_from_rule,
        labLow: latest.lab_low, labHigh: latest.lab_high,
      },
    });
  }

  return series.sort((a, b) => {
    const pa = ORDER.indexOf(a.panel);
    const pb = ORDER.indexOf(b.panel);
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return a.name.localeCompare(b.name, 'ru');
  });
}

export async function buildState(userId) {
  const user = await getUser(userId);
  if (!user) return null;

  const sex = user.sex === 'male' ? 'male' : 'female';
  const age = user.birth_year ? new Date().getFullYear() - Number(user.birth_year) : null;
  const goal = GOALS[user.goal] ? user.goal : 'general';
  const profile = { sex, age, goal };

  const rows = await allResults(userId);
  const series = buildSeries(rows, profile);
  const documents = await listDocuments(userId);
  const totals = await stats(userId);

  const latestByStatus = { normal: 0, high: 0, low: 0, borderline: 0, unknown: 0 };
  for (const s of series) latestByStatus[s.status] = (latestByStatus[s.status] || 0) + 1;

  const deviations = series.filter((s) => s.status === 'high' || s.status === 'low');
  const borderline = series.filter((s) => s.status === 'borderline');

  const changes = series
    .filter((s) => s.deltaFirst !== null && Math.abs(s.deltaFirst) > 1e-9)
    .sort((a, b) => b.significanceFirst - a.significanceFirst)
    .slice(0, 6)
    .map((s) => ({
      key: s.key, code: s.code, name: s.name, short: s.short, unit: s.unit,
      delta: s.deltaFirst, deltaPct: s.deltaFirstPct, status: s.status, panel: s.panel,
      latest: s.latest.value, first: s.first.value, prev: s.prev?.value ?? null,
      taken_at: s.latest.taken_at, first_date: s.first.taken_at, prev_date: s.prev?.taken_at ?? null,
      significance: s.significanceFirst, status_first: s.first.status,
    }));

  const panels = ORDER.map((key) => {
    const items = series.filter((s) => s.panel === key);
    if (!items.length) return null;
    const dev = items.filter((s) => s.status === 'high' || s.status === 'low').length;
    const bord = items.filter((s) => s.status === 'borderline').length;
    return {
      key, ...PANELS[key], total: items.length, deviations: dev, borderline: bord,
      samples: items.slice(0, 3).map((s) => ({ name: s.name, value: s.latest.value, unit: s.unit, status: s.status })),
    };
  }).filter(Boolean);

  return {
    profile: {
      id: user.id, name: user.name, sex: user.sex, birth_year: user.birth_year,
      age, goal, goalTitle: GOALS[goal].title, goalEmoji: GOALS[goal].emoji,
      goals: Object.values(GOALS),
    },
    stats: totals,
    documents: documents.map((d) => ({
      id: d.id, lab: d.lab, taken_at: d.taken_at, filename: d.filename,
      source: d.source, results_count: d.results_count,
    })),
    series,
    summary: {
      indicators: series.length,
      documents: documents.length,
      labs: totals.labs,
      last_date: documents.length ? documents[0].taken_at : null,
      deviations: deviations.length,
      borderline: borderline.length,
      statuses: latestByStatus,
      labs_list: [...new Set(documents.map((d) => d.lab).filter(Boolean))],
    },
    deviations: deviations.map((s) => ({
      key: s.key, name: s.name, short: s.short, value: s.latest.value, unit: s.unit,
      status: s.status, ref_low: s.latest.ref_low, ref_high: s.latest.ref_high,
      open_low: s.latest.open_low, open_high: s.latest.open_high, delta: s.delta, panel: s.panel,
    })),
    changes,
    panels,
    catalog: INDICATORS.map((item) => ({
      code: item.code, name: item.name, short: item.short, unit: item.unit, panel: item.panel,
    })),
  };
}
