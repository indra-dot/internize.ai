import { deidentifyText } from '../src/services/deid/deidentifier';

const tests = [
  'No. RM: 12-34-56',
  'RM: 12-34-56',
  'Nomor Rekam Medis: 12-34-56',
  'No. Rekam Medis: 123456',
  'MRN: 12-34-56',
  'MR# 123456',
];

for (const t of tests) {
  const res = deidentifyText(t);
  console.log(`Input: "${t}" -> Redacted: "${res.redactedText}" (Entities: ${res.entities.map(e => e.category + ': ' + e.text).join(', ')})`);
}
