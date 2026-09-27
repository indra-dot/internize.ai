/**
 * RxNorm Clinical Drug Lexicon & Sig Matcher
 * Curated high-frequency clinical medications with ingredient and SCD mappings.
 */

import type { RxNormTermType } from '../../types/clinical';

export interface RxNormScdEntry {
  rxcui: string;
  strengthPattern: RegExp;
  dosageDisplay: string;
  name: string; // e.g. "lisinopril 10 MG Oral Tablet"
}

export interface RxNormDrugEntry {
  ingredientRxcui: string;
  name: string;
  display: string;
  brandNames: string[];
  termType: RxNormTermType;
  scdEntries: RxNormScdEntry[];
}

export const RXNORM_LEXICON: RxNormDrugEntry[] = [
  {
    ingredientRxcui: '29046',
    name: 'lisinopril',
    display: 'lisinopril',
    brandNames: ['zestril', 'prinivil', 'qbrelis'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '314076',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'lisinopril 10 MG Oral Tablet',
      },
      {
        rxcui: '314077',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'lisinopril 20 MG Oral Tablet',
      },
      {
        rxcui: '314075',
        strengthPattern: /\b5\s*mg\b/i,
        dosageDisplay: '5mg',
        name: 'lisinopril 5 MG Oral Tablet',
      },
      {
        rxcui: '314078',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'lisinopril 40 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '6809',
    name: 'metformin',
    display: 'metformin',
    brandNames: ['glucophage', 'fortamet', 'glumetza'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '860975',
        strengthPattern: /\b500\s*mg\b/i,
        dosageDisplay: '500mg',
        name: 'metformin hydrochloride 500 MG Oral Tablet',
      },
      {
        rxcui: '860982',
        strengthPattern: /\b850\s*mg\b/i,
        dosageDisplay: '850mg',
        name: 'metformin hydrochloride 850 MG Oral Tablet',
      },
      {
        rxcui: '861007',
        strengthPattern: /\b1000\s*mg\b/i,
        dosageDisplay: '1000mg',
        name: 'metformin hydrochloride 1000 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '83367',
    name: 'atorvastatin',
    display: 'atorvastatin',
    brandNames: ['lipitor'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '259255',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'atorvastatin 20 MG Oral Tablet',
      },
      {
        rxcui: '617314',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'atorvastatin 10 MG Oral Tablet',
      },
      {
        rxcui: '259256',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'atorvastatin 40 MG Oral Tablet',
      },
      {
        rxcui: '259257',
        strengthPattern: /\b80\s*mg\b/i,
        dosageDisplay: '80mg',
        name: 'atorvastatin 80 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '17767',
    name: 'amlodipine',
    display: 'amlodipine',
    brandNames: ['norvasc', 'katerzia'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '197361',
        strengthPattern: /\b5\s*mg\b/i,
        dosageDisplay: '5mg',
        name: 'amlodipine 5 MG Oral Tablet',
      },
      {
        rxcui: '197362',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'amlodipine 10 MG Oral Tablet',
      },
      {
        rxcui: '197360',
        strengthPattern: /\b2\.5\s*mg\b/i,
        dosageDisplay: '2.5mg',
        name: 'amlodipine 2.5 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '5487',
    name: 'hydrochlorothiazide',
    display: 'hydrochlorothiazide',
    brandNames: ['microzide', 'esidrix', 'hctz'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '310798',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'hydrochlorothiazide 25 MG Oral Tablet',
      },
      {
        rxcui: '310797',
        strengthPattern: /\b12\.5\s*mg\b/i,
        dosageDisplay: '12.5mg',
        name: 'hydrochlorothiazide 12.5 MG Oral Tablet',
      },
      {
        rxcui: '310799',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'hydrochlorothiazide 50 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '7646',
    name: 'omeprazole',
    display: 'omeprazole',
    brandNames: ['prilosec'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '258414',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'omeprazole 20 MG Delayed Release Oral Capsule',
      },
      {
        rxcui: '258415',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'omeprazole 40 MG Delayed Release Oral Capsule',
      },
    ],
  },
  {
    ingredientRxcui: '6918',
    name: 'metoprolol',
    display: 'metoprolol',
    brandNames: ['lopressor', 'toprol', 'toprol-xl'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '866418',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'metoprolol tartrate 25 MG Oral Tablet',
      },
      {
        rxcui: '866427',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'metoprolol tartrate 50 MG Oral Tablet',
      },
      {
        rxcui: '866436',
        strengthPattern: /\b100\s*mg\b/i,
        dosageDisplay: '100mg',
        name: 'metoprolol tartrate 100 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '5224',
    name: 'losartan',
    display: 'losartan',
    brandNames: ['cozaar'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '316049',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'losartan potassium 50 MG Oral Tablet',
      },
      {
        rxcui: '316048',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'losartan potassium 25 MG Oral Tablet',
      },
      {
        rxcui: '316050',
        strengthPattern: /\b100\s*mg\b/i,
        dosageDisplay: '100mg',
        name: 'losartan potassium 100 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '435',
    name: 'albuterol',
    display: 'albuterol',
    brandNames: ['proair', 'ventolin', 'proventil'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '745678',
        strengthPattern: /\b(?:0\.09\s*mg|90\s*mcg)\b/i,
        dosageDisplay: '90mcg',
        name: 'albuterol 0.09 MG/ACTUAT Metered Dose Inhaler',
      },
    ],
  },
  {
    ingredientRxcui: '1191',
    name: 'aspirin',
    display: 'aspirin',
    brandNames: ['bayer', 'ecotrin', 'bufferin', 'asa'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '243670',
        strengthPattern: /\b81\s*mg\b/i,
        dosageDisplay: '81mg',
        name: 'aspirin 81 MG Delayed Release Oral Tablet',
      },
      {
        rxcui: '212170',
        strengthPattern: /\b325\s*mg\b/i,
        dosageDisplay: '325mg',
        name: 'aspirin 325 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '36567',
    name: 'simvastatin',
    display: 'simvastatin',
    brandNames: ['zocor'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '198211',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'simvastatin 20 MG Oral Tablet',
      },
      {
        rxcui: '198212',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'simvastatin 40 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '25480',
    name: 'gabapentin',
    display: 'gabapentin',
    brandNames: ['neurontin', 'gralise'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '310430',
        strengthPattern: /\b300\s*mg\b/i,
        dosageDisplay: '300mg',
        name: 'gabapentin 300 MG Oral Capsule',
      },
      {
        rxcui: '310429',
        strengthPattern: /\b100\s*mg\b/i,
        dosageDisplay: '100mg',
        name: 'gabapentin 100 MG Oral Capsule',
      },
      {
        rxcui: '310431',
        strengthPattern: /\b400\s*mg\b/i,
        dosageDisplay: '400mg',
        name: 'gabapentin 400 MG Oral Capsule',
      },
    ],
  },
  {
    ingredientRxcui: '36437',
    name: 'sertraline',
    display: 'sertraline',
    brandNames: ['zoloft'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '312940',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'sertraline 50 MG Oral Tablet',
      },
      {
        rxcui: '312939',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'sertraline 25 MG Oral Tablet',
      },
      {
        rxcui: '312941',
        strengthPattern: /\b100\s*mg\b/i,
        dosageDisplay: '100mg',
        name: 'sertraline 100 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '723',
    name: 'amoxicillin',
    display: 'amoxicillin',
    brandNames: ['amoxil', 'moxatag'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '308189',
        strengthPattern: /\b500\s*mg\b/i,
        dosageDisplay: '500mg',
        name: 'amoxicillin 500 MG Oral Capsule',
      },
      {
        rxcui: '308191',
        strengthPattern: /\b875\s*mg\b/i,
        dosageDisplay: '875mg',
        name: 'amoxicillin 875 MG Oral Tablet',
      },
      {
        rxcui: '308187',
        strengthPattern: /\b250\s*mg\b/i,
        dosageDisplay: '250mg',
        name: 'amoxicillin 250 MG Oral Capsule',
      },
    ],
  },
  {
    ingredientRxcui: '4603',
    name: 'furosemide',
    display: 'furosemide',
    brandNames: ['lasix'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '310429',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'furosemide 20 MG Oral Tablet',
      },
      {
        rxcui: '310430',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'furosemide 40 MG Oral Tablet',
      },
      {
        rxcui: '310431',
        strengthPattern: /\b80\s*mg\b/i,
        dosageDisplay: '80mg',
        name: 'furosemide 80 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '10582',
    name: 'levothyroxine',
    display: 'levothyroxine',
    brandNames: ['synthroid', 'levoxyl', 'tirosint', 'unithroid'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '311354',
        strengthPattern: /\b(?:50\s*mcg|0\.05\s*mg)\b/i,
        dosageDisplay: '50mcg',
        name: 'levothyroxine sodium 0.05 MG Oral Tablet',
      },
      {
        rxcui: '311355',
        strengthPattern: /\b(?:100\s*mcg|0\.1\s*mg)\b/i,
        dosageDisplay: '100mcg',
        name: 'levothyroxine sodium 0.1 MG Oral Tablet',
      },
      {
        rxcui: '311356',
        strengthPattern: /\b(?:25\s*mcg|0\.025\s*mg)\b/i,
        dosageDisplay: '25mcg',
        name: 'levothyroxine sodium 0.025 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '8640',
    name: 'prednisone',
    display: 'prednisone',
    brandNames: ['deltasone', 'rayos'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '312615',
        strengthPattern: /\b5\s*mg\b/i,
        dosageDisplay: '5mg',
        name: 'prednisone 5 MG Oral Tablet',
      },
      {
        rxcui: '312617',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'prednisone 10 MG Oral Tablet',
      },
      {
        rxcui: '312619',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'prednisone 20 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '5640',
    name: 'ibuprofen',
    display: 'ibuprofen',
    brandNames: ['advil', 'motrin', 'nuprin'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '197806',
        strengthPattern: /\b200\s*mg\b/i,
        dosageDisplay: '200mg',
        name: 'ibuprofen 200 MG Oral Tablet',
      },
      {
        rxcui: '197807',
        strengthPattern: /\b400\s*mg\b/i,
        dosageDisplay: '400mg',
        name: 'ibuprofen 400 MG Oral Tablet',
      },
      {
        rxcui: '197808',
        strengthPattern: /\b600\s*mg\b/i,
        dosageDisplay: '600mg',
        name: 'ibuprofen 600 MG Oral Tablet',
      },
      {
        rxcui: '197809',
        strengthPattern: /\b800\s*mg\b/i,
        dosageDisplay: '800mg',
        name: 'ibuprofen 800 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '161',
    name: 'acetaminophen',
    display: 'acetaminophen',
    brandNames: ['tylenol', 'paracetamol', 'panadol', 'apap'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '198440',
        strengthPattern: /\b500\s*mg\b/i,
        dosageDisplay: '500mg',
        name: 'acetaminophen 500 MG Oral Tablet',
      },
      {
        rxcui: '198439',
        strengthPattern: /\b325\s*mg\b/i,
        dosageDisplay: '325mg',
        name: 'acetaminophen 325 MG Oral Tablet',
      },
      {
        rxcui: '198441',
        strengthPattern: /\b650\s*mg\b/i,
        dosageDisplay: '650mg',
        name: 'acetaminophen 650 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '40790',
    name: 'pantoprazole',
    display: 'pantoprazole',
    brandNames: ['protonix'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '259942',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'pantoprazole 40 MG Delayed Release Oral Tablet',
      },
      {
        rxcui: '259941',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'pantoprazole 20 MG Delayed Release Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '32968',
    name: 'clopidogrel',
    display: 'clopidogrel',
    brandNames: ['plavix'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '309362',
        strengthPattern: /\b75\s*mg\b/i,
        dosageDisplay: '75mg',
        name: 'clopidogrel 75 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '20352',
    name: 'carvedilol',
    display: 'carvedilol',
    brandNames: ['coreg'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '315677',
        strengthPattern: /\b6\.25\s*mg\b/i,
        dosageDisplay: '6.25mg',
        name: 'carvedilol 6.25 MG Oral Tablet',
      },
      {
        rxcui: '315678',
        strengthPattern: /\b12\.5\s*mg\b/i,
        dosageDisplay: '12.5mg',
        name: 'carvedilol 12.5 MG Oral Tablet',
      },
      {
        rxcui: '315679',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'carvedilol 25 MG Oral Tablet',
      },
      {
        rxcui: '315676',
        strengthPattern: /\b3\.125\s*mg\b/i,
        dosageDisplay: '3.125mg',
        name: 'carvedilol 3.125 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '2556',
    name: 'citalopram',
    display: 'citalopram',
    brandNames: ['celexa'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '309309',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'citalopram 20 MG Oral Tablet',
      },
      {
        rxcui: '309310',
        strengthPattern: /\b40\s*mg\b/i,
        dosageDisplay: '40mg',
        name: 'citalopram 40 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '10689',
    name: 'tramadol',
    display: 'tramadol',
    brandNames: ['ultram', 'conzip'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '836408',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'tramadol hydrochloride 50 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '5856',
    name: 'insulin',
    display: 'insulin',
    brandNames: ['humulin', 'novolin', 'lantus', 'humalog', 'novolog'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '285018',
        strengthPattern: /\b100\s*(?:units?|u|unt)\b/i,
        dosageDisplay: '100 units/ml',
        name: 'insulin human 100 UNT/ML Injectable Solution',
      },
    ],
  },
  {
    ingredientRxcui: '321988',
    name: 'escitalopram',
    display: 'escitalopram',
    brandNames: ['lexapro'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '352741',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'escitalopram 10 MG Oral Tablet',
      },
      {
        rxcui: '352742',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'escitalopram 20 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '4493',
    name: 'fluoxetine',
    display: 'fluoxetine',
    brandNames: ['prozac'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '310385',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'fluoxetine 20 MG Oral Capsule',
      },
    ],
  },
  {
    ingredientRxcui: '301542',
    name: 'rosuvastatin',
    display: 'rosuvastatin',
    brandNames: ['crestor'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '363944',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'rosuvastatin calcium 10 MG Oral Tablet',
      },
      {
        rxcui: '363945',
        strengthPattern: /\b20\s*mg\b/i,
        dosageDisplay: '20mg',
        name: 'rosuvastatin calcium 20 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '1202',
    name: 'atenolol',
    display: 'atenolol',
    brandNames: ['tenormin'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '197379',
        strengthPattern: /\b50\s*mg\b/i,
        dosageDisplay: '50mg',
        name: 'atenolol 50 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '9997',
    name: 'spironolactone',
    display: 'spironolactone',
    brandNames: ['aldactone', 'carospir'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '313098',
        strengthPattern: /\b25\s*mg\b/i,
        dosageDisplay: '25mg',
        name: 'spironolactone 25 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '11289',
    name: 'warfarin',
    display: 'warfarin',
    brandNames: ['coumadin', 'jantoven'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '855333',
        strengthPattern: /\b5\s*mg\b/i,
        dosageDisplay: '5mg',
        name: 'warfarin sodium 5 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '1364430',
    name: 'apixaban',
    display: 'apixaban',
    brandNames: ['eliquis'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '1364444',
        strengthPattern: /\b5\s*mg\b/i,
        dosageDisplay: '5mg',
        name: 'apixaban 5 MG Oral Tablet',
      },
    ],
  },
  {
    ingredientRxcui: '72266',
    name: 'montelukast',
    display: 'montelukast',
    brandNames: ['singulair'],
    termType: 'IN',
    scdEntries: [
      {
        rxcui: '311762',
        strengthPattern: /\b10\s*mg\b/i,
        dosageDisplay: '10mg',
        name: 'montelukast 10 MG Oral Tablet',
      },
    ],
  },
];

// Regular expressions for sig parsing
export const DOSAGE_REGEX =
  /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ml|units?|unit|meq|iu|%))(?:\s*\/\s*(?:hari|day|kg|kgbb|dose|dosis))?\b/gi;
export const FREQUENCY_REGEX =
  /\b(once daily|twice daily|three times daily|four times daily|daily|bid|tid|qid|prn|at bedtime|qhs|qam|qpm|q8h|q12h|q24h|weekly|every morning|every evening|as needed|sehari sekali|sehari dua kali|sehari tiga kali|1x1|1x sehari|2x1|2x sehari|3x1|3x sehari|4x1|pagi dan malam|pagi siang malam|malam hari|sekali sehari|dua kali sehari|tiga kali sehari|satu kali sehari)\b/gi;
export const ROUTE_REGEX =
  /\b(oral|po|subcutaneous|subq|sq|intravenous|iv|intramuscular|im|topical|inhalation|inhaled|sublingual|sl|transdermal|ophthalmic|otic|nasal|per oral|diminum|dimakan|ditelan|intravena|intramuskular|subkutan|topikal|inhalasi|tetes mata|tetes telinga|supositoria|suppository)\b/gi;

export interface ExtractedRxNormMatch {
  rxcui: string;
  name: string;
  termType: RxNormTermType;
  ttyDisplay: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  scdRxcui?: string;
  scdName?: string;
  matchedText: string;
  confidence: number;
  start: number;
  end: number;
  reconciliationStatus: 'Reconciled' | 'Needs Review' | 'Active';
}

/**
 * Searches text for RxNorm medications, extracting strength, route, and frequency.
 */
export function lookupRxNormConcepts(text: string): ExtractedRxNormMatch[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const results: ExtractedRxNormMatch[] = [];
  const matchedRxcuis = new Set<string>();

  for (const drug of RXNORM_LEXICON) {
    // Check if ingredient or any brand name matches
    const searchTerms = [drug.name, ...drug.brandNames];
    const patternStr = `\\b(?:${searchTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`;
    const regex = new RegExp(patternStr, 'gi');

    const match: RegExpExecArray | null = regex.exec(text);
    while (match !== null) {
      if (matchedRxcuis.has(drug.ingredientRxcui)) {
        break;
      }

      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      // Look in window around the drug name (up to 40 characters after) for dosage, route, frequency
      const postWindow = text.slice(matchEnd, Math.min(text.length, matchEnd + 50));
      const fullContextWindow = text.slice(
        Math.max(0, matchStart - 15),
        Math.min(text.length, matchEnd + 60),
      );

      // Extract dosage
      let dosage: string | undefined;
      let matchedScd: RxNormScdEntry | undefined;

      DOSAGE_REGEX.lastIndex = 0;
      let dosageMatch = DOSAGE_REGEX.exec(postWindow);
      if (!dosageMatch) {
        DOSAGE_REGEX.lastIndex = 0;
        dosageMatch = DOSAGE_REGEX.exec(fullContextWindow);
      }
      DOSAGE_REGEX.lastIndex = 0;
      if (dosageMatch) {
        dosage = dosageMatch[1].replace(/\s+/g, '').toLowerCase() + (dosageMatch[2] || '');

        // Check if dosage matches a specific SCD
        matchedScd = drug.scdEntries.find((scd) => scd.strengthPattern.test(dosageMatch[0]));
      }

      // Extract frequency
      let frequency: string | undefined;
      FREQUENCY_REGEX.lastIndex = 0;
      const freqMatch = FREQUENCY_REGEX.exec(fullContextWindow);
      FREQUENCY_REGEX.lastIndex = 0;
      if (freqMatch) {
        frequency = freqMatch[1].toLowerCase();
      }

      // Extract route
      let route: string | undefined;
      ROUTE_REGEX.lastIndex = 0;
      const routeMatch = ROUTE_REGEX.exec(fullContextWindow);
      ROUTE_REGEX.lastIndex = 0;
      if (routeMatch) {
        route = routeMatch[1].toUpperCase();
      } else {
        route = 'Oral'; // Standard default for tablets/capsules
      }

      // Compute matchedText span covering the medication and immediate dosage/frequency if consecutive
      let compositeEnd = matchEnd;
      const immediateSnippetRegex =
        /^\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|meq))(?:\s+(?:daily|once daily|bid|tid|qid|prn|at bedtime|oral|po))*/i;
      const immMatch = immediateSnippetRegex.exec(postWindow);
      let matchedText = match[0];
      if (immMatch) {
        compositeEnd = matchEnd + immMatch[0].length;
        matchedText = text.slice(matchStart, compositeEnd);
      }

      matchedRxcuis.add(drug.ingredientRxcui);

      results.push({
        rxcui: drug.ingredientRxcui,
        name: drug.name,
        termType: drug.termType,
        ttyDisplay: drug.display,
        dosage,
        route,
        frequency,
        scdRxcui: matchedScd?.rxcui,
        scdName: matchedScd?.name,
        matchedText,
        confidence: 0.97,
        start: matchStart,
        end: compositeEnd,
        reconciliationStatus: 'Reconciled',
      });

      break; // move to next drug
    }
  }

  return results;
}
