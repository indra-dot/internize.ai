import { lookupSnomedConcepts, SNOMED_LEXICON } from '../src/services/clinical/snomedDictionary';
import { isNegatedSpan, CrogeEngine } from '../src/services/clinical/croge';
import { deidentifyText } from '../src/services/deid/deidentifier';

const t = 'Ny. Siti Rahmawati, Medical Record: MR-987654, tgl lahir 15-08-1980, no telp (021) 555-4321, riwayat acute myocardial infarction dan chest pain, konsumsi aspirin 80mg daily oral dan atorvastatin 20mg at bedtime.';

console.log('--- Direct lookupSnomedConcepts on raw:');
const rawConcepts = lookupSnomedConcepts(t);
console.log(rawConcepts.map(c => `${c.preferredTerm} [${c.code}]`));

const deid = deidentifyText(t);
console.log('--- Deidentified text:');
console.log(deid.redactedText);

console.log('--- lookupSnomedConcepts on deidentified text:');
const deidConcepts = lookupSnomedConcepts(deid.redactedText);
console.log(deidConcepts.map(c => `${c.preferredTerm} [${c.code}]`));

console.log('--- CrogeEngine.extractSnomed on raw text:');
const crogeSnomed = CrogeEngine.extractSnomed(t);
console.log(crogeSnomed.map(c => `${c.preferredTerm} [${c.code}]`));

const match = SNOMED_LEXICON.find(c => c.code === '22298006');
console.log('--- SNOMED concept 22298006 entry:', match);
