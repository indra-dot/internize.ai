import { InternalMedicineEngine } from '../../src/services/clinical/internalMedicineEngine';

// Test existing sample cases first to ensure zero regression
const preopSample = `Konsul TS Bedah: Pasien 60 th dengan DM tipe 2 dan Hipertensi, rencana kolesistektomi. TD 150/90, GDS 210, Hb 11.5, Cr 1.1. RPO Metformin, Amlodipin.`;
const preopRes = InternalMedicineEngine.generateConsultationAnswer(preopSample, 'preop');
console.log('Preop sample tolerance:', preopRes.toleranceStatus);
console.log('Preop sample problems:', preopRes.problems.map(p => `[${p.division}] ${p.title}`));

const krisisSample = `Konsul TS Bedah: Pasien rencana laparotomi elektif. TD 200/120 mmHg, K 6.4, GDS 360, Troponin positif.`;
const krisisRes = InternalMedicineEngine.generateConsultationAnswer(krisisSample, 'preop');
console.log('Krisis sample tolerance:', krisisRes.toleranceStatus);
