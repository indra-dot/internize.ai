import { describe, expect, it } from 'vitest';
import {
  routeClinicalContextToCalculators,
  type PatientContextSnapshot,
} from '../../src/services/clinical/cdss/contextRouter';

describe('Milestone 7: CDSS Context Router & Modal Integration', () => {
  it('should route antimicrobial renal dosing when patient receives meropenem with elevated creatinine', () => {
    const context: PatientContextSnapshot = {
      age: 62,
      gender: 'male',
      weightKg: 65,
      heightCm: 170,
      labs: {
        creatinine: 2.4,
      },
      medications: ['Meropenem 1g q8h', 'Omeprazole 40mg'],
      diagnoses: ['Sepsis', 'Pneumonia'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    expect(suggestions.length).toBeGreaterThan(0);

    const mero = suggestions.find((s) => s.calculatorId.includes('meropenem'));
    expect(mero).toBeDefined();
    expect(mero?.suite).toBe('ADJUSTR_IO');
    expect(mero?.priority).toBe('high');
    expect(mero?.prefilledInputs.serumCreatinine).toBe(2.4);
    expect(mero?.prefilledInputs.age).toBe(62);
  });

  it('should route severe hyperkalemia to Calc-Med potassium repletion with high priority', () => {
    const context: PatientContextSnapshot = {
      labs: {
        potassium: 6.8,
        creatinine: 3.5,
      },
      diagnoses: ['CKD Stage 5 on HD', 'Hiperkalemia'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const kSug = suggestions.find((s) => s.calculatorId === 'fluid-potassium');
    expect(kSug).toBeDefined();
    expect(kSug?.suite).toBe('FLUID');
    expect(kSug?.priority).toBe('high');
    expect(kSug?.prefilledInputs.kSerum).toBe(6.8);
    expect(kSug?.reason).toContain('Kalium abnormal');
  });

  it('should route severe hyponatremia with ODS ceiling alert', () => {
    const context: PatientContextSnapshot = {
      weightKg: 55,
      gender: 'female',
      labs: {
        sodium: 114,
      },
      diagnoses: ['Hiponatremia simtomatik'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const naSug = suggestions.find((s) => s.calculatorId === 'fluid-hyponatremia');
    expect(naSug).toBeDefined();
    expect(naSug?.suite).toBe('FLUID');
    expect(naSug?.priority).toBe('high');
    expect(naSug?.prefilledInputs.serumNa).toBe(114);
    expect(naSug?.prefilledInputs.weightKg).toBe(55);
  });

  it('should route DKA and flag hypokalemia guardrail if K < 3.5', () => {
    const context: PatientContextSnapshot = {
      labs: {
        glucose: 480,
        ph: 7.15,
        hco3: 10,
        potassium: 3.1,
      },
      diagnoses: ['Ketoasidosis Diabetik', 'DM Tipe 1'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const dkaSug = suggestions.find((s) => s.calculatorId === 'emd-dka-tracker');
    expect(dkaSug).toBeDefined();
    expect(dkaSug?.suite).toBe('EMD');
    expect(dkaSug?.priority).toBe('high');
    expect(dkaSug?.prefilledInputs.bloodGlucose).toBe(480);
    expect(dkaSug?.prefilledInputs.serumPotassium).toBe(3.1);
  });

  it('should route thyroid storm when tachycardia + high fever present', () => {
    const context: PatientContextSnapshot = {
      vitals: {
        temp: 39.5,
        hr: 140,
        sbp: 150,
      },
      diagnoses: ['Krisis Tiroid', 'Hipertiroid'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const bwpsSug = suggestions.find((s) => s.calculatorId === 'emd-bwps');
    expect(bwpsSug).toBeDefined();
    expect(bwpsSug?.suite).toBe('EMD');
    expect(bwpsSug?.priority).toBe('high');
    expect(bwpsSug?.prefilledInputs.tempCelsius).toBe(39.5);
    expect(bwpsSug?.prefilledInputs.heartRate).toBe(140);
  });

  it('should route GI bleeding to GBS calculator', () => {
    const context: PatientContextSnapshot = {
      gender: 'male',
      vitals: {
        sbp: 95,
        hr: 110,
      },
      labs: {
        hemoglobin: 7.8,
        ureum: 90,
      },
      diagnoses: ['Hematemesis Melena', 'Suspek Ruptur Varises Esofagus'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const gbsSug = suggestions.find((s) => s.calculatorId === 'geh-gbs');
    expect(gbsSug).toBeDefined();
    expect(gbsSug?.suite).toBe('GEH');
    expect(gbsSug?.priority).toBe('high');
    expect(gbsSug?.prefilledInputs.hemoglobin).toBe(7.8);
    expect(gbsSug?.prefilledInputs.hasMelena).toBe(true);
  });

  it('should route febrile neutropenia to MASCC risk index', () => {
    const context: PatientContextSnapshot = {
      age: 48,
      vitals: {
        temp: 38.8,
        sbp: 115,
      },
      diagnoses: ['Karsinoma Mamae post AC', 'Neutropenia Febril'],
    };

    const suggestions = routeClinicalContextToCalculators(context);
    const masccSug = suggestions.find((s) => s.calculatorId === 'hom-mascc');
    expect(masccSug).toBeDefined();
    expect(masccSug?.suite).toBe('HOM');
    expect(masccSug?.priority).toBe('high');
    expect(masccSug?.prefilledInputs.ageBelow60).toBe(true);
  });
});
