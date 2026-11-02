// Демо-история: 5 сдач из двух лабораторий за год.

import { pathToFileURL } from 'node:url';
import { addDocument, clearUser, ensureUser, updateProfile } from './db.js';
import { BY_CODE } from './catalog.js';

const DOCS = [
  {
    lab: 'Инвитро', taken_at: '2025-08-12', filename: 'invitro_2025-08-12.pdf', source: 'demo',
    results: [
      ['hemoglobin', 118, '120 - 150'], ['rbc', 4.1, '3.8 - 5.1'], ['hct', 36, '35 - 45'],
      ['mcv', 86, '80 - 100'], ['mch', 29, '27 - 34'], ['plt', 245, '180 - 320'],
      ['wbc', 5.6, '4.0 - 9.0'], ['neutrophils', 58, '47 - 72'], ['lymphocytes', 32, '19 - 37'],
      ['monocytes', 6, '3 - 11'], ['eosinophils', 3, '0.5 - 5'], ['esr', 14, '2 - 15'],
      ['ferritin', 12, '15 - 150'], ['iron', 7.8, '9 - 30'], ['glucose', 4.9, '3.9 - 6.1'],
      ['alt', 22, '0 - 31'], ['ast', 20, '0 - 31'], ['cholesterol', 5.6, '0 - 5.2'],
      ['ldl', 3.4, '0 - 3.0'], ['hdl', 1.35, '1.2 - 2.5'], ['triglycerides', 1.4, '0 - 1.7'],
      ['tsh', 2.1, '0.4 - 4.0'], ['vitamin_d', 18, '30 - 100'],
    ],
  },
  {
    lab: 'Гемотест', taken_at: '2025-11-20', filename: 'gemotest_2025-11-20.pdf', source: 'demo',
    results: [
      ['hemoglobin', 124, '117 - 155'], ['ferritin', 18, '13 - 150'], ['iron', 9.5, '9 - 30'],
      ['vitamin_d', 24, '30 - 100'], ['crp', 1.2, '0 - 5'], ['esr', 11, '2 - 15'],
    ],
  },
  {
    lab: 'Инвитро', taken_at: '2026-02-10', filename: 'invitro_2026-02-10.pdf', source: 'demo',
    results: [
      ['hemoglobin', 129, '120 - 150'], ['ferritin', 34, '15 - 150'], ['vitamin_d', 38, '30 - 100'],
      ['cholesterol', 5.4, '0 - 5.2'], ['ldl', 3.2, '0 - 3.0'], ['hdl', 1.4, '1.2 - 2.5'],
      ['triglycerides', 1.2, '0 - 1.7'], ['alt', 19, '0 - 31'], ['ast', 18, '0 - 31'],
      ['glucose', 4.7, '3.9 - 6.1'], ['hba1c', 5.1, '4.0 - 5.6'], ['tsh', 1.9, '0.4 - 4.0'],
      ['ft4', 14.2, '9 - 22'], ['b12', 340, '187 - 883'], ['creatinine', 78, '53 - 97'],
      ['urea', 5.1, '2.5 - 8.3'], ['uric_acid', 240, '150 - 350'], ['bilirubin_total', 12.4, '3.4 - 20.5'],
      ['albumin', 44, '35 - 52'], ['total_protein', 72, '64 - 83'], ['calcium', 2.35, '2.15 - 2.55'],
      ['magnesium', 0.85, '0.66 - 1.07'], ['potassium', 4.2, '3.5 - 5.1'], ['sodium', 140, '136 - 145'],
      ['phosphorus', 1.1, '0.87 - 1.45'], ['crp', 0.8, '0 - 5'], ['esr', 9, '2 - 15'],
    ],
  },
  {
    lab: 'Гемотест', taken_at: '2026-05-14', filename: 'gemotest_2026-05-14.pdf', source: 'demo',
    results: [
      ['hemoglobin', 133, '117 - 155'], ['rbc', 4.4, '3.8 - 5.1'], ['hct', 39, '35 - 45'],
      ['mcv', 88, '80 - 100'], ['mch', 30, '27 - 34'], ['plt', 260, '180 - 320'],
      ['wbc', 6.1, '4.0 - 9.0'], ['ferritin', 48, '13 - 150'], ['iron', 16.1, '9 - 30'],
      ['vitamin_d', 42, '30 - 100'], ['tsh', 2.2, '0.4 - 4.0'], ['cholesterol', 5.1, '0 - 5.2'],
      ['ldl', 3.1, '0 - 3.0'], ['hdl', 1.5, '1.2 - 2.5'], ['triglycerides', 1.0, '0 - 1.7'],
      ['insulin', 8.4, '2.6 - 24.9'], ['glucose', 4.8, '3.9 - 6.1'], ['alt', 18, '0 - 31'],
      ['ast', 17, '0 - 31'], ['crp', 0.5, '0 - 5'], ['esr', 8, '2 - 15'],
    ],
  },
  {
    lab: 'Инвитро', taken_at: '2026-09-05', filename: 'invitro_2026-09-05.pdf', source: 'demo',
    results: [
      ['hemoglobin', 135, '120 - 150'], ['ferritin', 52, '15 - 150'], ['iron', 14.2, '9 - 30'],
      ['vitamin_d', 28, '30 - 100'], ['tsh', 2.0, '0.4 - 4.0'], ['cholesterol', 5.4, '0 - 5.2'],
      ['ldl', 3.3, '0 - 3.0'], ['hdl', 1.55, '1.2 - 2.5'], ['triglycerides', 0.9, '0 - 1.7'],
      ['glucose', 4.9, '3.9 - 6.1'], ['hba1c', 5.0, '4.0 - 5.6'], ['crp', 0.4, '0 - 5'],
      ['alt', 17, '0 - 31'], ['ast', 16, '0 - 31'], ['b12', 380, '187 - 883'],
      ['magnesium', 0.88, '0.66 - 1.07'], ['calcium', 2.4, '2.15 - 2.55'], ['creatinine', 75, '53 - 97'],
      ['esr', 7, '2 - 15'], ['plt', 255, '180 - 320'], ['wbc', 5.9, '4.0 - 9.0'],
    ],
  },
];

function parseRef(ref) {
  const value = String(ref || '').trim();
  const range = value.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
  if (range) {
    return {
      ref_low: Number(range[1].replace(',', '.')),
      ref_high: Number(range[2].replace(',', '.')),
      ref_text: value,
    };
  }
  const less = value.match(/^(?:<|до|не более)\s*(\d+(?:[.,]\d+)?)$/i);
  if (less) return { ref_low: null, ref_high: Number(less[1].replace(',', '.')), ref_text: value };
  const more = value.match(/^(?:>|от)\s*(\d+(?:[.,]\d+)?)$/i);
  if (more) return { ref_low: Number(more[1].replace(',', '.')), ref_high: null, ref_text: value };
  return { ref_low: null, ref_high: null, ref_text: value };
}

export async function seedDemo(userId = 'demo', { reset = true } = {}) {
  if (reset) await clearUser(userId);
  await ensureUser(userId, 'Катя', 'female');
  await updateProfile(userId, { name: 'Катя', sex: 'female' });

  for (const doc of DOCS) {
    const results = doc.results.map(([code, value, ref]) => {
      const indicator = BY_CODE.get(code);
      const range = parseRef(ref);
      return {
        code,
        name: indicator?.name || code,
        raw_name: indicator?.name || code,
        value,
        unit: indicator?.unit || '',
        ...range,
      };
    });
    await addDocument(userId, { lab: doc.lab, taken_at: doc.taken_at, filename: doc.filename, source: doc.source }, results);
  }

  return { documents: DOCS.length, results: DOCS.reduce((sum, d) => sum + d.results.length, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await seedDemo(process.env.DEMO_USER || 'demo');
  console.log('Демо-данные загружены:', result);
  process.exit(0);
}
