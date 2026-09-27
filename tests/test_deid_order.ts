import { deidentifyText } from '../src/services/deid/deidentifier';

const sample1 = 'Medical Record: MR-987654';
const res1 = deidentifyText(sample1);
console.log('Sample 1 input:', sample1);
console.log('Sample 1 redacted:', res1.redactedText);
console.log('Sample 1 entities:', res1.entities);

const sample2 = 'MRN: MR-987654';
const res2 = deidentifyText(sample2);
console.log('\nSample 2 input:', sample2);
console.log('Sample 2 redacted:', res2.redactedText);
console.log('Sample 2 entities:', res2.entities);
