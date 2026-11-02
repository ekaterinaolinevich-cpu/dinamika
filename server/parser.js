// Разбор лабораторных бланков: PDF или текст → строки «показатель / значение / единица / референс».

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { matchIndicator, normalizeName } from './catalog.js';

const UNIT_RE = /^[%‰]|^[A-Za-zА-Яа-яЁёµμ][A-Za-zА-Яа-яЁёµμ0-9^×xX*/\-¹²³⁴⁵⁶⁷⁸⁹.,]*$/;

const SKIP_WORDS = [
  'пациент', 'пациентка', 'дата', 'заказ', 'номер заказа', 'штрих', 'страница', 'стр.', 'итог', 'итого',
  'референс', 'референсные', 'норма', 'показатель', 'результат', 'единиц', 'комментарий', 'подготов',
  'адрес', 'телефон', 'сайт', 'лицензия', 'подпись', 'врач', 'наименование', 'метод', 'материал',
  'биоматериал', 'код', 'услуга', 'стоимость', 'сумма', 'скидка', 'ндс', 'возраст', 'пол', 'лет',
  'год', 'время', 'срок', 'количество', 'дата взятия', 'дата готовности', 'дата регистрации',
  'контейнер', 'оборудование', 'реагент', 'производитель', 'нормативы', 'диапазон',
  'женщины', 'мужчины', 'беременные', 'дети', 'взрослые',
];

const LAB_PATTERNS = [
  [/инвитро|invitro/i, 'Инвитро'],
  [/гемотест|gemotest/i, 'Гемотест'],
  [/хеликс|helix/i, 'Хеликс'],
  [/ситилаб|citylab/i, 'Ситилаб'],
  [/\bcmd\b|цмд/i, 'CMD'],
  [/лабквест|labquest/i, 'ЛабКвест'],
  [/медси|medsi/i, 'Медси'],
  [/\bkdl\b|кдл/i, 'KDL'],
  [/см-клиник|sm-clinic/i, 'СМ-Клиника'],
];

function toNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function stripDates(line) {
  return line
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
}

function collectNumbers(line) {
  const out = [];
  const re = /\d+(?:[.,]\d+)?/g;
  let match;
  while ((match = re.exec(line))) {
    const start = match.index;
    const end = start + match[0].length;
    const prev = start > 0 ? line[start - 1] : '';
    const next = end < line.length ? line[end] : '';
    const leftOk = !prev || /[\s(]/.test(prev);
    const rightOk = !next || /[\s)%,.;:=]/.test(next);
    if (!leftOk || !rightOk) continue;
    out.push({ raw: match[0], value: toNumber(match[0]), start, end });
  }
  return out;
}

function cleanName(raw) {
  return raw
    .replace(/^[\s\-–—•·*]+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/[.:;,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeName(name) {
  if (!name || name.length < 3 || name.length > 90) return false;
  if (!/[а-яёa-z]/i.test(name)) return false;
  const lower = normalizeName(name);
  if (!lower) return false;
  return !SKIP_WORDS.some((word) => lower === word || lower.startsWith(word + ' '));
}

function extractUnit(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 18) return null;
  if (!UNIT_RE.test(cleaned)) return null;
  if (/^[а-яё]+$/i.test(cleaned) && cleaned.length > 5) return null;
  return cleaned.replace(/^[.,;:]+|[.,;:]+$/g, '');
}

function parseColumns(line) {
  if (!/[;\t]/.test(line)) return null;
  const parts = line.split(/[;\t]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const name = parts[0];
  if (!looksLikeName(name)) return null;

  const valueIndex = parts.findIndex((p, i) => i > 0 && /^-?\d+(?:[.,]\d+)?$/.test(p));
  if (valueIndex === -1) return null;

  const value = toNumber(parts[valueIndex]);
  const unit = parts[valueIndex + 1] && !/^-?\d+(?:[.,]\d+)?$/.test(parts[valueIndex + 1]) ? parts[valueIndex + 1] : null;
  const rest = parts.slice(valueIndex + (unit ? 2 : 1)).join(' ');
  const rangeMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/);
  const lessMatch = rest.match(/(?:до|<|<=|не более)\s*(\d+(?:[.,]\d+)?)/i);

  if (!rangeMatch && !lessMatch) return null;

  return {
    name,
    value,
    unit: unit || null,
    ref_low: rangeMatch ? toNumber(rangeMatch[1]) : null,
    ref_high: rangeMatch ? toNumber(rangeMatch[2]) : toNumber(lessMatch[1]),
    ref_text: rangeMatch ? rangeMatch[0] : lessMatch[0],
    confidence: 'column',
  };
}

function parseLine(rawLine) {
  let line = String(rawLine)
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/…|\.{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (line.length < 5) return null;

  const column = parseColumns(line);
  if (column) return column;

  line = stripDates(line).replace(/\s+/g, ' ').trim();
  if (line.length < 4) return null;

  // OCR часто пишет «0- 31» — приводим диапазон к «120 - 150».
  line = line.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 - $2');

  const numbers = collectNumbers(line);
  if (!numbers.length) return null;

  let range = null;
  for (let i = 0; i < numbers.length - 1; i += 1) {
    const a = numbers[i];
    const b = numbers[i + 1];
    const between = line.slice(a.end, b.start).trim();
    if (between === '-') {
      range = { low: a, high: b, index: i };
      break;
    }
  }

  let openRange = null;
  if (!range) {
    const m = line.match(/(?:до|не более|<|<=|≤)\s*(\d+(?:[.,]\d+)?)/i);
    if (m) {
      const start = line.indexOf(m[0]);
      const numStart = start + m[0].length - m[1].length;
      openRange = { value: toNumber(m[1]), start: numStart, end: start + m[0].length, text: m[0] };
    }
  }

  const boundary = range ? range.low.start : openRange ? openRange.start : line.length;
  const candidatesBefore = numbers.filter((n) => n.end <= boundary);
  if (!candidatesBefore.length) return null;

  const valueToken = candidatesBefore[candidatesBefore.length - 1];
  const name = cleanName(line.slice(0, valueToken.start));
  if (!looksLikeName(name)) return null;

  const unitText = line.slice(valueToken.end, boundary);
  const unitFromLine = extractUnit(unitText);

  const indicator = matchIndicator(name, { unit: unitFromLine });

  if (!indicator && !range && !openRange && !unitFromLine) return null;

  return {
    name,
    value: valueToken.value,
    unit: unitFromLine || indicator?.unit || null,
    ref_low: range ? range.low.value : null,
    ref_high: range ? range.high.value : openRange ? openRange.value : null,
    ref_text: range ? `${range.low.raw} - ${range.high.raw}` : openRange ? openRange.text.trim() : null,
    confidence: indicator ? 'high' : range || openRange ? 'medium' : 'low',
    indicator: indicator || null,
  };
}

export function detectLab(text) {
  const head = text.slice(0, 4000);
  for (const [pattern, label] of LAB_PATTERNS) {
    if (pattern.test(head)) return label;
  }
  const line = head.split(/\n/).map((l) => l.trim()).find((l) => /лаборатор|клиник|медицин/i.test(l) && l.length < 60);
  return line || 'Лаборатория';
}

function toIso(raw) {
  const [d, mo, y] = String(raw).split(/[./-]/);
  let year = Number(y);
  if (year < 100) year += 2000;
  if (!(year >= 2015 && year <= 2035)) return null;
  return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function detectDate(text, filename = '') {
  const candidates = [];
  const monthNames = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  };

  const push = (iso) => {
    const year = Number(iso.slice(0, 4));
    if (year >= 2015 && year <= 2035) candidates.push(iso);
  };

  const re = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  let m;
  while ((m = re.exec(text))) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    push(`${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  }

  const reText = /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/gi;
  while ((m = reText.exec(text))) {
    const month = monthNames[m[2].toLowerCase()];
    if (month) push(`${m[3]}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  }

  if (!candidates.length && filename) {
    const fileMatch = filename.match(/(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/);
    if (fileMatch) {
      let year = Number(fileMatch[3]);
      if (year < 100) year += 2000;
      push(`${year}-${String(fileMatch[2]).padStart(2, '0')}-${String(fileMatch[1]).padStart(2, '0')}`);
    }
  }

  if (!candidates.length) return null;

  const labeled = [
    /дата\s+(?:взятия|забора|сдачи|исследования|регистрации|готовности)[^0-9]{0,40}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(?:взят|забор|сдач|исследован)[^0-9]{0,30}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
  ];

  for (const pattern of labeled) {
    const match = text.match(pattern);
    if (!match) continue;
    const iso = toIso(match[1]);
    if (iso) return iso;
  }

  const anyDate = [...text.matchAll(/(?:дата|date)([^0-9]{0,40})(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/gi)];
  for (const match of anyDate) {
    if (/рождени|birth/i.test(match[1] || '')) continue;
    const iso = toIso(match[2]);
    if (iso) return iso;
  }

  return candidates.sort().at(-1);
}

export function parseText(text, options = {}) {
  const filename = options.filename || '';
  const lines = String(text || '').split(/\r?\n/);
  const results = [];
  const skipped = [];
  const seen = new Set();

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      if (line.trim().length > 8) skipped.push(line.trim());
      continue;
    }

    const code = parsed.indicator?.code || null;
    const dedupeKey = code || normalizeName(parsed.name);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      code,
      name: parsed.indicator?.name || parsed.name,
      raw_name: parsed.name,
      value: parsed.value,
      unit: parsed.unit,
      ref_low: parsed.ref_low,
      ref_high: parsed.ref_high,
      ref_text: parsed.ref_text,
      confidence: parsed.confidence,
      matched: Boolean(parsed.indicator),
    });
  }

  return {
    lab: options.lab || detectLab(text),
    taken_at: options.taken_at || detectDate(text, filename),
    results,
    skipped,
    stats: { lines: lines.length, parsed: results.length, matched: results.filter((r) => r.matched).length },
  };
}

export async function parsePdf(buffer, options = {}) {
  const data = await pdfParse(buffer);
  const parsed = parseText(data.text, options);
  return { ...parsed, pages: data.numpages, text: data.text };
}

export async function parseUpload(buffer, filename = '', mimetype = '') {
  const lower = filename.toLowerCase();
  const isPdf = mimetype === 'application/pdf' || lower.endsWith('.pdf') || buffer.subarray(0, 4).toString() === '%PDF';

  if (isPdf) return parsePdf(buffer, { filename });

  const text = buffer.toString('utf8');
  if (looksLikeBinary(text)) {
    throw new Error('Это не похоже на текстовый файл. Пришли PDF или вставь текст бланка.');
  }
  return parseText(text, { filename });
}

function looksLikeBinary(text) {
  if (!text) return false;
  let suspicious = 0;
  for (let i = 0; i < Math.min(text.length, 4000); i += 1) {
    const code = text.charCodeAt(i);
    if (code === 0 || (code < 9 && code !== 0)) suspicious += 1;
  }
  return suspicious > 20;
}
