import { deidentifyText } from '../src/services/deid/deidentifier';

const tests = [
  'HP: 081234567890',
  'WA: 0812-3456-7890',
  'Telp: +62 812-3456-7890',
  'Kontak: 0812-345-6789',
  'Phone: 555-123-4567',
  'Telp: (021) 555-4321',
];

for (const t of tests) {
  const res = deidentifyText(t);
  console.log(`Input: "${t}" -> Redacted: "${res.redactedText}" (Entities: ${res.entities.map(e => e.category + ': ' + e.text).join(', ')})`);
}
