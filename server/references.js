// Референсные значения с поправкой на пол, возраст и цель.
// Правила переопределяют одну или обе границы базового диапазона.

import { BY_CODE } from './catalog.js';

export const EVIDENCE = {
  guideline: { label: 'рекомендация', hint: 'Есть клинические рекомендации' },
  consensus: { label: 'консенсус', hint: 'Согласованная позиция специалистов' },
  practice: { label: 'практика', hint: 'Клиническая практика, строгих норм нет' },
};

export const GOALS = {
  general: { key: 'general', title: 'Общий чек-ап', short: 'Общий', emoji: '🩺', description: 'Обычные референсы лабораторий' },
  hair: { key: 'hair', title: 'Волосы и кожа', short: 'Волосы', emoji: '💇', description: 'Выше цели по ферритину и витамину D' },
  pregnancy: { key: 'pregnancy', title: 'Беременность и планирование', short: 'Беременность', emoji: '🤰', description: 'Пороги ВОЗ и ATA для планирования' },
  cardio: { key: 'cardio', title: 'Сердце и сосуды', short: 'Кардио', emoji: '❤️', description: 'Цели по ЛПНП и СРБ из рекомендаций ESC' },
  sport: { key: 'sport', title: 'Спорт и энергия', short: 'Спорт', emoji: '🏃', description: 'Запасы железа и витамин D под нагрузки' },
};

export const SOURCES = {
  who2024: { label: 'ВОЗ, 2024', title: 'Guideline on haemoglobin cutoffs to define anaemia in individuals and populations', year: 2024, url: 'https://www.who.int/publications/i/item/9789240088542' },
  who2020: { label: 'ВОЗ, 2020', title: 'WHO guideline on use of ferritin concentrations to assess iron status', year: 2020, url: 'https://www.ncbi.nlm.nih.gov/books/NBK569880/' },
  es2024: { label: 'Endocrine Society, 2024', title: 'Vitamin D for the Prevention of Disease: Clinical Practice Guideline', year: 2024, url: 'https://academic.oup.com/jcem/issue/109/8' },
  ata2017: { label: 'ATA, 2017', title: 'Guidelines for the Diagnosis and Management of Thyroid Disease During Pregnancy', year: 2017, url: 'https://www.liebertpub.com/doi/10.1089/thy.2016.0457' },
  esc2019: { label: 'ESC/EAS, 2019', title: 'Guidelines for the management of dyslipidaemias', year: 2019, url: 'https://academic.oup.com/eurheartj/article/41/1/111/5556353' },
  aha2003: { label: 'AHA/CDC, 2003', title: 'Markers of Inflammation and Cardiovascular Disease', year: 2003, url: 'https://www.ahajournals.org/doi/10.1161/01.CIR.0000052939.59093.45' },
  ada2025: { label: 'ADA, 2025', title: 'Standards of Care in Diabetes—2025', year: 2025, url: 'https://diabetesjournals.org/care/issue/48/Supplement_1' },
  lab: { label: 'Бланк лаборатории', title: 'Референс из твоего результата', year: null, url: null },
  practice: { label: 'Клиническая практика', title: 'Наблюдательные данные, строгих норм нет', year: null, url: null },
};

const RULES = {
  hemoglobin: [
    { id: 'hb-6-23m', ageMax: 1.99, low: 105, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: у детей 6–23 месяцев анемия при гемоглобине ниже 105 г/л.' },
    { id: 'hb-2-4y', ageMin: 2, ageMax: 4, low: 110, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: у детей 24–59 месяцев анемия при гемоглобине ниже 110 г/л.' },
    { id: 'hb-5-11y', ageMin: 5, ageMax: 11, low: 115, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: у детей 5–11 лет анемия при гемоглобине ниже 115 г/л.' },
    { id: 'hb-12-14y', ageMin: 12, ageMax: 14, low: 120, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: у детей 12–14 лет анемия при гемоглобине ниже 120 г/л.' },
    { id: 'hb-15-17m', sex: 'male', ageMin: 15, ageMax: 17, low: 130, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: у юношей с 15 лет порог анемии — 130 г/л.' },
    { id: 'hb-pregnancy', goal: 'pregnancy', low: 110, evidence: 'guideline', source: 'who2024', note: 'ВОЗ 2024: при беременности анемия при гемоглобине ниже 110 г/л.' },
  ],

  ferritin: [
    { id: 'ferritin-hair', goal: 'hair', low: 40, high: 200, evidence: 'practice', source: 'practice', note: 'При выпадении волос трихологи часто ориентируются на ферритин от 40 нг/мл. Строгих норм нет: это практика, а не рекомендация.' },
    { id: 'ferritin-pregnancy', goal: 'pregnancy', low: 30, high: 150, evidence: 'consensus', source: 'who2020', note: 'Для планирования беременности запас железа лучше держать от 30 нг/мл: ВОЗ считает дефицитом ферритин ниже 15, но при планировании порог поднимают.' },
    { id: 'ferritin-sport', goal: 'sport', low: 30, high: 200, evidence: 'practice', source: 'practice', note: 'При регулярных нагрузках железо расходуется быстрее, поэтому цели выше лабораторных.' },
    { id: 'ferritin-child', ageMax: 17, low: 12, high: 140, evidence: 'consensus', source: 'who2020', note: 'У детей запасы железа ниже, чем у взрослых.' },
  ],

  vitamin_d: [
    { id: 'vitd-default', low: 20, high: 60, evidence: 'guideline', source: 'es2024', note: 'Endocrine Society 2024: дефицит — ниже 20 нг/мл; верхняя граница условная. Рутинно контролировать витамин D здоровым людям не рекомендуют.' },
    { id: 'vitd-hair', goal: 'hair', low: 30, high: 60, evidence: 'practice', source: 'practice', note: 'Для кожи и волос обычно держат витамин D от 30 нг/мл, хотя доказательная база именно для волос слабая.' },
    { id: 'vitd-pregnancy', goal: 'pregnancy', low: 30, high: 60, evidence: 'consensus', source: 'practice', note: 'При планировании и беременности чаще ориентируются на 30 нг/мл и выше.' },
    { id: 'vitd-sport', goal: 'sport', low: 30, high: 60, evidence: 'practice', source: 'practice', note: 'При активных нагрузках витамин D влияет на мышцы и восстановление, цель — от 30 нг/мл.' },
    { id: 'vitd-child', ageMax: 17, low: 20, high: 60, evidence: 'guideline', source: 'es2024', note: 'Endocrine Society 2024: у детей дефицит — ниже 20 нг/мл.' },
  ],

  tsh: [
    { id: 'tsh-pregnancy', goal: 'pregnancy', low: 0.4, high: 2.5, evidence: 'guideline', source: 'ata2017', note: 'ATA: при планировании и в первом триместре верхняя граница ТТГ — 2,5 мЕд/л.' },
    { id: 'tsh-65', ageMin: 65, high: 4.5, evidence: 'consensus', source: 'practice', note: 'После 65 лет верхняя граница ТТГ чуть выше — около 4,5 мЕд/л.' },
  ],

  ldl: [
    { id: 'ldl-cardio', goal: 'cardio', high: 1.8, evidence: 'guideline', source: 'esc2019', note: 'ESC/EAS: при высоком сердечно-сосудистом риске цель по ЛПНП — ниже 1,8 ммоль/л, при очень высоком — ниже 1,4.' },
  ],

  cholesterol: [
    { id: 'chol-cardio', goal: 'cardio', high: 4.5, evidence: 'guideline', source: 'esc2019', note: 'При высоком риске общий холестерин держат ниже 4,5 ммоль/л, но главная цель — ЛПНП.' },
  ],

  crp: [
    { id: 'crp-cardio', goal: 'cardio', high: 3, evidence: 'guideline', source: 'aha2003', note: 'СРБ как маркер риска: ниже 1 мг/л — низкий, 1–3 — средний, выше 3 — высокий сердечно-сосудистый риск.' },
  ],

  glucose: [
    { id: 'glucose-cardio', goal: 'cardio', high: 5.6, evidence: 'guideline', source: 'ada2025', note: 'ADA: нормальный сахар натощак — ниже 5,6 ммоль/л, 5,6–6,9 — преддиабет.' },
  ],

  hba1c: [
    { id: 'hba1c-cardio', goal: 'cardio', high: 5.6, evidence: 'guideline', source: 'ada2025', note: 'ADA: 5,7–6,4% — преддиабет, 6,5% и выше — диабет.' },
  ],

  esr: [
    { id: 'esr-50-f', sex: 'female', ageMin: 50, high: 30, evidence: 'consensus', source: 'practice', note: 'С возрастом СОЭ растёт: после 50 лет у женщин верхняя граница около 30 мм/ч.' },
    { id: 'esr-50-m', sex: 'male', ageMin: 50, high: 20, evidence: 'consensus', source: 'practice', note: 'С возрастом СОЭ растёт: после 50 лет у мужчин верхняя граница около 20 мм/ч.' },
  ],

  alp: [
    { id: 'alp-child', ageMin: 1, ageMax: 12, low: 100, high: 350, evidence: 'consensus', source: 'practice', note: 'У детей щелочная фосфатаза выше из-за роста костей — это нормально.' },
    { id: 'alp-teen', ageMin: 13, ageMax: 17, low: 50, high: 280, evidence: 'consensus', source: 'practice', note: 'В подростковом возрасте щелочная фосфатаза ещё повышена из-за роста.' },
  ],

  testosterone: [
    { id: 'test-m-18-39', sex: 'male', ageMin: 18, ageMax: 39, low: 9.2, high: 31.8, evidence: 'consensus', source: 'practice', note: 'У мужчин тестостерон постепенно снижается с возрастом, поэтому диапазоны по десятилетиям.' },
    { id: 'test-m-40-59', sex: 'male', ageMin: 40, ageMax: 59, low: 7.6, high: 26.0, evidence: 'consensus', source: 'practice', note: 'У мужчин тестостерон постепенно снижается с возрастом, поэтому диапазоны по десятилетиям.' },
    { id: 'test-m-60', sex: 'male', ageMin: 60, low: 6.0, high: 22.0, evidence: 'consensus', source: 'practice', note: 'У мужчин тестостерон постепенно снижается с возрастом, поэтому диапазоны по десятилетиям.' },
  ],
};

function describeRule(rule) {
  const parts = [];
  if (rule.goal) parts.push(`цель «${GOALS[rule.goal]?.short || rule.goal}»`);
  if (rule.ageMin != null || rule.ageMax != null) {
    if (rule.ageMin != null && rule.ageMax != null) parts.push(`возраст ${rule.ageMin}–${rule.ageMax} лет`);
    else if (rule.ageMin != null) parts.push(`возраст от ${rule.ageMin} лет`);
    else parts.push(`возраст до ${rule.ageMax} лет`);
  }
  if (rule.sex) parts.push(rule.sex === 'male' ? 'для мужчин' : 'для женщин');
  return parts.length ? parts.join(', ') : 'стандартный референс';
}

function specificity(rule) {
  return (rule.goal ? 2 : 0) + (rule.ageMin != null || rule.ageMax != null ? 1 : 0) + (rule.sex ? 1 : 0);
}

function ruleMatches(rule, { sex, age, goal }) {
  if (rule.goal && rule.goal !== goal) return false;
  if (rule.sex && rule.sex !== sex) return false;
  if (rule.ageMin != null && (age == null || age < rule.ageMin)) return false;
  if (rule.ageMax != null && (age == null || age > rule.ageMax)) return false;
  return true;
}

export function rulesFor(code) {
  return RULES[code] || [];
}

export function resolveReference(code, profile = {}) {
  const indicator = BY_CODE.get(code);
  if (!indicator) return null;

  const sex = profile.sex === 'male' ? 'male' : 'female';
  const age = Number.isFinite(profile.age) ? Number(profile.age) : null;
  const goal = GOALS[profile.goal] ? profile.goal : 'general';

  const base = indicator.ref[sex] || indicator.ref.female;
  let low = base?.[0] ?? null;
  let high = base?.[1] ?? null;
  let openLow = indicator.openLow;
  let openHigh = indicator.openHigh;

  const matched = rulesFor(code)
    .filter((rule) => ruleMatches(rule, { sex, age, goal }))
    .sort((a, b) => specificity(b) - specificity(a));

  const rule = matched[0] || null;

  if (rule) {
    if (rule.low !== undefined) low = rule.low;
    if (rule.high !== undefined) high = rule.high;
    if (rule.openLow !== undefined) openLow = rule.openLow;
    if (rule.openHigh !== undefined) openHigh = rule.openHigh;
  }

  return {
    low,
    high,
    openLow,
    openHigh,
    ruleId: rule?.id || null,
    label: rule ? describeRule(rule) : 'стандартный референс',
    note: rule?.note || '',
    evidence: rule?.evidence || null,
    source: rule?.source ? SOURCES[rule.source] : null,
    goal,
  };
}

export function profileSummary(profile = {}) {
  const age = Number.isFinite(profile.age) ? profile.age : null;
  const goal = GOALS[profile.goal] || GOALS.general;
  return { sex: profile.sex === 'male' ? 'male' : 'female', age, goal: goal.key, goalTitle: goal.title, goalEmoji: goal.emoji, hasAge: age != null };
}
