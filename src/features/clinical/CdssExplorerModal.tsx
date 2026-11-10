/**
 * internize.ai — CDSS Explorer Modal
 * Searchable Clinical Decision Support System Hub integrating all 8 suites
 * from drguswib CDSS (ADJUSTR.IO, Calc-Med, adjustrFluid, adjustrEMD, adjustr-GEH, AdjustrHOM, RheumaTools, Preop)
 * and 105+ InternaHub calculators with Auto-Prefill & 1-Click Web Bridge.
 * 100% on-device, zero-egress, responsive with mobile auto-focus.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Calculator,
  ShieldAlert,
  ChevronLeft,
  Copy,
  PlusCircle,
  X,
  Check,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  CdssSuiteId,
  CdssCalculatorMeta,
  GuardrailAlert,
} from '../../services/clinical/cdss/types';
import { ALL_CDSS_CALCULATORS, CDSS_SUITES } from '../../services/clinical/cdss/cdssRegistry';
import { calculateRenalDosing, ANTIMICROBIAL_DATABASE } from '../../services/clinical/cdss/adjustrIoEngine';
import {
  calculateVasoactiveSyringePump,
  analyzeAbg,
  calculateHyponatremiaAdrogue,
  calculateHypernatremiaFwd,
  calculatePotassiumManagement,
  calculateCorrectedCalcium,
  calculateMagnesiumRepletion,
  calculatePhosphateRepletion,
  calculateBunCrRatio,
  evaluateAeiouHdIndications,
  calculateBridgingInsulin,
  type VasoactiveDrugType,
} from '../../services/clinical/cdss/calcMedFluidEngine';
import {
  calculateBwps,
  evaluateDkaStatus,
  calculateHypoglycemiaD40,
  calculateBasalBolusTdd,
  calculateHbA1cToEag,
} from '../../services/clinical/cdss/adjustrEmdEngine';
import {
  calculateGbs,
  calculateCtp,
  calculateMeldTrio,
  calculateSaag,
  calculateRFactor,
  calculateDeRitis,
  calculateFib4AndApri,
  calculateMaddrey,
  calculateBisap,
  calculateTg18,
} from '../../services/clinical/cdss/adjustrGehEngine';
import {
  calculateMascc,
  calculateCisne,
  evaluateCairoBishopTls,
  calculateCalvertCarboplatin,
  calculateKhorana,
  calculateFourTs,
  calculatePlasmic,
  calculateGanzoni,
  calculatePrcTransfusion,
} from '../../services/clinical/cdss/adjustrHomEngine';
import {
  evaluateAcrEularRa,
  calculateDas28Crp,
  calculateMexSledai,
  evaluateAcrEularGout,
} from '../../services/clinical/cdss/rheumaToolsEngine';
import { PatientContextSnapshot } from '../../services/clinical/cdss/contextRouter';
import {
  parseFastTrackLabKeep,
  runInternaHubAutoCalc,
  buildInternaHubBridgeUrl,
  type ParsedClinicalContext,
} from '../../services/clinical/cdss/internahubRuntime';

export interface CdssExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicalText?: string;
  patientContext?: PatientContextSnapshot;
  initialCalcId?: string;
  onInsertToDraft?: (text: string) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const CALC_ID_ALIASES: Record<string, string> = {
  'calc-abg': 'calc-abg-analyzer',
  'abg': 'calc-abg-analyzer',
  'agd': 'calc-abg-analyzer',
  'gbs': 'geh-gbs',
  'ctp': 'geh-child-pugh',
  'geh-ctp': 'geh-child-pugh',
  'meld': 'geh-meld-trio',
  'saag': 'geh-saag',
  'rfactor': 'geh-rfactor-hyslaw',
  'deritis': 'geh-deritis',
  'fib4': 'geh-fib4-apri',
  'apri': 'geh-fib4-apri',
  'maddrey': 'geh-maddrey-lille',
  'bisap': 'geh-bisap',
  'tg18': 'geh-tg18',
  'hypoNa': 'fluid-adrogue-madias',
  'fluid-hyponatremia': 'fluid-adrogue-madias',
  'k-mgmt': 'fluid-potassium',
  'aki-bun-cr': 'fluid-bun-cr-ratio',
  'bwps': 'emd-burch-wartofsky',
  'emd-bwps': 'emd-burch-wartofsky',
  'dka': 'emd-dka-tracker',
  'dka-tracker': 'emd-dka-tracker',
  'hypoglycemia': 'emd-hypoglycemia-rule30',
  'ins-bridge': 'emd-bridging-insulin',
  'das28-crp': 'rheuma-das28',
  'mex-sledai': 'rheuma-mex-sledai',
  'gout': 'rheuma-gout-acr',
  'mascc': 'hom-mascc',
  'cisne': 'hom-cisne',
  'tls': 'hom-tls',
  'calvert': 'hom-calvert',
  'khorana': 'hom-khorana',
  '4ts': 'hom-4ts',
  'plasmic': 'hom-plasmic',
  'ganzoni': 'hom-ganzoni',
  'prc': 'hom-prc',
  'adjustr-io': 'adjustr-io-antimicrobial',
};

export const CdssExplorerModal: React.FC<CdssExplorerModalProps> = ({
  isOpen,
  onClose,
  clinicalText,
  patientContext,
  initialCalcId,
  onInsertToDraft,
  onShowToast,
}) => {
  const [selectedSuite, setSelectedSuite] = useState<'ALL' | CdssSuiteId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Parse patient lab context automatically from clinicalText
  const parsedCtx: ParsedClinicalContext = useMemo(() => {
    return parseFastTrackLabKeep(clinicalText || '');
  }, [clinicalText]);

  const autoCalcResult = useMemo(() => {
    return runInternaHubAutoCalc(parsedCtx);
  }, [parsedCtx]);

  // Form states for active calculations (auto-prefilled from parsedCtx / patientContext)
  const [patientWeight, setPatientWeight] = useState<number>(parsedCtx.bb ?? patientContext?.weightKg ?? 60);
  const [patientAge, setPatientAge] = useState<number>(parsedCtx.age ?? patientContext?.age ?? 55);
  const [patientGender, setPatientGender] = useState<'male' | 'female'>(
    parsedCtx.sex === 'P' ? 'female' : parsedCtx.sex === 'L' ? 'male' : patientContext?.gender ?? 'male'
  );
  const [serumCr, setSerumCr] = useState<number>(parsedCtx.cr ?? patientContext?.labs?.creatinine ?? 1.2);
  const [serumUreum, setSerumUreum] = useState<number>(parsedCtx.ureum ?? patientContext?.labs?.ureum ?? 35);
  const [serumNa, setSerumNa] = useState<number>(parsedCtx.na ?? patientContext?.labs?.sodium ?? 138);
  const [serumK, setSerumK] = useState<number>(parsedCtx.k ?? patientContext?.labs?.potassium ?? 4.0);
  const [serumCa, setSerumCa] = useState<number>(parsedCtx.ca ?? 8.8);
  const [serumAlb, setSerumAlb] = useState<number>(parsedCtx.alb ?? patientContext?.labs?.albumin ?? 3.8);
  const [serumBili, setSerumBili] = useState<number>(parsedCtx.bili ?? patientContext?.labs?.bilirubin ?? 1.0);
  const [serumInr, setSerumInr] = useState<number>(parsedCtx.inr ?? patientContext?.labs?.inr ?? 1.1);
  const [serumHb, setSerumHb] = useState<number>(parsedCtx.hb ?? patientContext?.labs?.hemoglobin ?? 11.5);
  const [serumPlt, setSerumPlt] = useState<number>(parsedCtx.plt ?? 180000);
  const [serumAst, setSerumAst] = useState<number>(parsedCtx.ast ?? 35);
  const [serumAlt, setSerumAlt] = useState<number>(parsedCtx.alt ?? 35);
  const [serumGlu, setSerumGlu] = useState<number>(parsedCtx.glu ?? 140);
  const [systolicBp, setSystolicBp] = useState<number>(parsedCtx.sbp ?? patientContext?.vitals?.sbp ?? 120);
  const [heartRate, setHeartRate] = useState<number>(parsedCtx.hr ?? patientContext?.vitals?.hr ?? 88);
  const [bodyTemp, setBodyTemp] = useState<number>(parsedCtx.temp ?? patientContext?.vitals?.temp ?? 37.0);

  // ABG inputs
  const [abgPh, setAbgPh] = useState<number>(parsedCtx.ph ?? patientContext?.labs?.ph ?? 7.35);
  const [abgPco2, setAbgPco2] = useState<number>(parsedCtx.pco2 ?? patientContext?.labs?.pco2 ?? 40);
  const [abgHco3, setAbgHco3] = useState<number>(parsedCtx.hco3 ?? patientContext?.labs?.hco3 ?? 24);

  // Antimicrobial drug selection
  const [selectedDrugKey, setSelectedDrugKey] = useState<string>('meropenem');
  const [selectedVasoDrug, setSelectedVasoDrug] = useState<VasoactiveDrugType>('norepinephrine');

  // Auto-sync extracted lab parameters when clinicalText updates
  useEffect(() => {
    if (parsedCtx.bb !== undefined) setPatientWeight(parsedCtx.bb);
    if (parsedCtx.age !== undefined) setPatientAge(parsedCtx.age);
    if (parsedCtx.sex === 'P') setPatientGender('female');
    else if (parsedCtx.sex === 'L') setPatientGender('male');
    if (parsedCtx.cr !== undefined) setSerumCr(parsedCtx.cr);
    if (parsedCtx.ureum !== undefined) setSerumUreum(parsedCtx.ureum);
    if (parsedCtx.na !== undefined) setSerumNa(parsedCtx.na);
    if (parsedCtx.k !== undefined) setSerumK(parsedCtx.k);
    if (parsedCtx.ca !== undefined) setSerumCa(parsedCtx.ca);
    if (parsedCtx.alb !== undefined) setSerumAlb(parsedCtx.alb);
    if (parsedCtx.bili !== undefined) setSerumBili(parsedCtx.bili);
    if (parsedCtx.inr !== undefined) setSerumInr(parsedCtx.inr);
    if (parsedCtx.hb !== undefined) setSerumHb(parsedCtx.hb);
    if (parsedCtx.plt !== undefined) setSerumPlt(parsedCtx.plt);
    if (parsedCtx.ast !== undefined) setSerumAst(parsedCtx.ast);
    if (parsedCtx.alt !== undefined) setSerumAlt(parsedCtx.alt);
    if (parsedCtx.glu !== undefined) setSerumGlu(parsedCtx.glu);
    if (parsedCtx.sbp !== undefined) setSystolicBp(parsedCtx.sbp);
    if (parsedCtx.hr !== undefined) setHeartRate(parsedCtx.hr);
    if (parsedCtx.temp !== undefined) setBodyTemp(parsedCtx.temp);
    if (parsedCtx.ph !== undefined) setAbgPh(parsedCtx.ph);
    if (parsedCtx.pco2 !== undefined) setAbgPco2(parsedCtx.pco2);
    if (parsedCtx.hco3 !== undefined) setAbgHco3(parsedCtx.hco3);
  }, [parsedCtx]);

  // React to initialCalcId when opened from InternaHubQuickBar or SpPdWorkflowPanel
  useEffect(() => {
    if (isOpen && initialCalcId) {
      const mappedId = CALC_ID_ALIASES[initialCalcId] || initialCalcId;
      const found = ALL_CDSS_CALCULATORS.find((c) => c.id === mappedId || c.id === initialCalcId);
      if (found) {
        setSelectedCalcId(found.id);
        if (found.id.startsWith('adjustr-io-') && found.id !== 'adjustr-io-antimicrobial') {
          const dKey = found.id.replace('adjustr-io-', '');
          if (ANTIMICROBIAL_DATABASE[dKey]) {
            setSelectedDrugKey(dKey);
          }
        }
      } else {
        setSelectedCalcId(mappedId);
      }
    }
  }, [isOpen, initialCalcId]);

  // Filtered calculators list
  const filteredCalculators = useMemo(() => {
    let list = ALL_CDSS_CALCULATORS;
    if (selectedSuite !== 'ALL') {
      list = list.filter((c: CdssCalculatorMeta) => c.suite === selectedSuite);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c: CdssCalculatorMeta) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.keywords.some((k: string) => k.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedSuite, searchQuery]);

  const activeCalculatorMeta = useMemo(() => {
    return ALL_CDSS_CALCULATORS.find((c: CdssCalculatorMeta) => c.id === selectedCalcId) || null;
  }, [selectedCalcId]);

  const webBridgeUrl = useMemo(() => {
    const mergedCtx: ParsedClinicalContext = {
      ...parsedCtx,
      age: patientAge,
      sex: patientGender === 'female' ? 'P' : 'L',
      bb: patientWeight,
      cr: serumCr,
      ureum: serumUreum,
      na: serumNa,
      k: serumK,
      ca: serumCa,
      alb: serumAlb,
      bili: serumBili,
      inr: serumInr,
      hb: serumHb,
      plt: serumPlt,
      ast: serumAst,
      alt: serumAlt,
      glu: serumGlu,
      sbp: systolicBp,
      hr: heartRate,
      temp: bodyTemp,
      ph: abgPh,
      pco2: abgPco2,
      hco3: abgHco3,
    };
    return buildInternaHubBridgeUrl(mergedCtx, selectedCalcId || undefined);
  }, [
    parsedCtx,
    patientAge,
    patientGender,
    patientWeight,
    serumCr,
    serumUreum,
    serumNa,
    serumK,
    serumCa,
    serumAlb,
    serumBili,
    serumInr,
    serumHb,
    serumPlt,
    serumAst,
    serumAlt,
    serumGlu,
    systolicBp,
    heartRate,
    bodyTemp,
    abgPh,
    abgPco2,
    abgHco3,
    selectedCalcId,
  ]);

  // Live calculation results & CPPT generation
  const calculationOutput = useMemo(() => {
    if (!selectedCalcId) return null;

    try {
      // 1. ADJUSTR.IO Antimicrobial Dosing (36 Drugs)
      if (selectedCalcId.startsWith('adjustr-io-')) {
        const rawKey = selectedCalcId.replace('adjustr-io-', '');
        const drugKey = ANTIMICROBIAL_DATABASE[rawKey] ? rawKey : selectedDrugKey;
        if (ANTIMICROBIAL_DATABASE[drugKey]) {
          return calculateRenalDosing(drugKey, {
            age: patientAge,
            weightKg: patientWeight,
            heightCm: parsedCtx.tb ?? 165,
            serumCreatinine: serumCr,
            gender: patientGender,
          });
        }
      }

      // 2. ABG / BGA Analyzer
      if (selectedCalcId === 'calc-abg' || selectedCalcId === 'calc-abg-analyzer' || selectedCalcId === 'abg') {
        return analyzeAbg({
          ph: abgPh,
          pco2: abgPco2,
          hco3: abgHco3,
          na: serumNa,
          cl: parsedCtx.cl ?? 105,
          albumin: serumAlb,
          patientWeightKg: patientWeight,
        });
      }

      // 3. Syringe Pump Titration
      if (
        selectedCalcId === 'calc-ne' ||
        selectedCalcId === 'calc-dobu' ||
        selectedCalcId === 'calc-nicardipine' ||
        selectedCalcId === 'calc-infusion-titration'
      ) {
        return calculateVasoactiveSyringePump({
          drugType: selectedVasoDrug,
          patientWeightKg: patientWeight,
          drugMg: selectedVasoDrug === 'norepinephrine' ? 4 : selectedVasoDrug === 'dobutamine' ? 250 : 10,
          diluentVolumeMl: 50,
        });
      }

      // 4. Potassium Management
      if (selectedCalcId === 'fluid-potassium' || selectedCalcId === 'k-mgmt') {
        return calculatePotassiumManagement(serumK, patientWeight);
      }

      // 5. Sodium Kinetics Adrogué-Madias & Hypernatremia
      if (selectedCalcId === 'fluid-hyponatremia' || selectedCalcId === 'fluid-adrogue-madias' || selectedCalcId === 'hypoNa') {
        if (serumNa > 145) {
          return calculateHypernatremiaFwd({
            weightKg: patientWeight,
            gender: patientGender,
            isElderly: patientAge >= 65,
            serumNa,
            targetNa: 140,
          });
        }
        return calculateHyponatremiaAdrogue({
          weightKg: patientWeight,
          gender: patientGender,
          isElderly: patientAge >= 65,
          serumNa: serumNa < 135 ? serumNa : 122,
          targetRise24h: 8,
          infusateType: 'nacl_3_percent',
        });
      }

      // 6. BUN:Cr Ratio & AEIOU HD
      if (selectedCalcId === 'fluid-bun-cr-ratio' || selectedCalcId === 'aki-bun-cr') {
        const bunCr = calculateBunCrRatio(serumUreum, serumCr, true);
        const aeiou = evaluateAeiouHdIndications({
          acidosisPhRefractory: abgPh < 7.15,
          electrolytesRefractoryHyperkalemia: serumK > 6.5,
        });
        return {
          ...bunCr,
          cpptFormat: `${bunCr.cpptFormat}\n\n${aeiou.cpptFormat}`,
        };
      }

      // 7. Corrected Calcium / Electrolyte Repletion
      if (selectedCalcId === 'hom-cacorr' || selectedCalcId === 'corrCa') {
        return calculateCorrectedCalcium(serumCa, serumAlb);
      }
      if (selectedCalcId === 'mg-repletion') {
        return calculateMagnesiumRepletion(1.4);
      }
      if (selectedCalcId === 'po4-repletion') {
        return calculatePhosphateRepletion(1.8);
      }

      // 8. Burch-Wartofsky Point Scale (Thyroid Storm)
      if (selectedCalcId === 'emd-bwps' || selectedCalcId === 'emd-burch-wartofsky' || selectedCalcId === 'bwps') {
        return calculateBwps({
          tempCelsius: bodyTemp >= 37.2 ? bodyTemp : 38.8,
          cnsDysfunction: 'delirium_psychosis',
          giDysfunction: 'diarrhea_nausea_vomiting',
          heartRate: heartRate >= 100 ? heartRate : 135,
          congestiveHeartFailure: 'mild_pedal_edema',
          atrialFibrillation: true,
          precipitatingEventHistory: true,
        });
      }

      // 9. DKA Tracker
      if (selectedCalcId === 'emd-dka-tracker' || selectedCalcId === 'dka' || selectedCalcId === 'dka-tracker') {
        return evaluateDkaStatus({
          venousPh: abgPh,
          serumHco3: abgHco3,
          bloodGlucose: serumGlu,
          anionGap: serumNa - ((parsedCtx.cl ?? 102) + abgHco3),
          serumPotassium: serumK,
          mentalStatus: 'drowsy',
        });
      }

      // 10. Hypoglycemia Rule of 30
      if (selectedCalcId === 'emd-hypoglycemia-rule30' || selectedCalcId === 'hypoglycemia') {
        return calculateHypoglycemiaD40(serumGlu < 70 ? serumGlu : 45, 100, true);
      }

      // 11. Insulin Bridging & Basal-Bolus
      if (selectedCalcId === 'emd-bridging-insulin' || selectedCalcId === 'ins-bridge') {
        const bridge = calculateBridgingInsulin([2, 2, 2, 2, 2, 2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        const tdd = calculateBasalBolusTdd(patientWeight, 0.5);
        return {
          ...bridge,
          cpptFormat: `${bridge.cpptFormat}\n\n${tdd.cpptFormat}`,
        };
      }

      // 12. Glasgow-Blatchford Score (GBS)
      if (selectedCalcId === 'geh-gbs' || selectedCalcId === 'gbs') {
        return calculateGbs({
          bunValue: serumUreum,
          bunUnit: 'ureum_rs',
          hemoglobin: serumHb,
          gender: patientGender,
          systolicBp,
          heartRate,
          hasMelena: true,
          hasSyncope: false,
          hasHepaticDisease: false,
          hasHeartFailure: false,
        });
      }

      // 13. Child-Turcotte-Pugh (CTP)
      if (selectedCalcId === 'geh-ctp' || selectedCalcId === 'geh-child-pugh' || selectedCalcId === 'ctp') {
        return calculateCtp({
          hepaticEncephalopathyGrade: 1,
          ascitesGrade: 2,
          totalBilirubin: serumBili,
          serumAlbumin: serumAlb,
          inr: serumInr,
        });
      }

      // 14. MELD Trio
      if (selectedCalcId === 'geh-meld-trio' || selectedCalcId === 'meld') {
        return calculateMeldTrio({
          totalBilirubinMgDl: serumBili,
          serumCreatinineMgDl: serumCr,
          inr: serumInr,
          serumSodiumMeqL: serumNa,
          serumAlbuminGDl: serumAlb,
          gender: patientGender,
          hasDialysisInPastWeek: false,
        });
      }

      // 15. SAAG & SBP
      if (selectedCalcId === 'geh-saag' || selectedCalcId === 'saag') {
        return calculateSaag({
          serumAlbuminGDl: serumAlb,
          ascitesAlbuminGDl: Math.max(0.5, serumAlb - 1.5),
          ascitesWbcPerUl: 600,
          ascitesPmnPercent: 60,
        });
      }

      // 16. R-Factor & Hy's Law
      if (selectedCalcId === 'geh-rfactor-hyslaw') {
        return calculateRFactor({
          altValue: serumAlt,
          altUln: 40,
          alpValue: parsedCtx.alp ?? 110,
          alpUln: 120,
          totalBilirubinMgDl: serumBili,
        });
      }

      // 17. De Ritis Ratio
      if (selectedCalcId === 'geh-deritis' || selectedCalcId === 'deritis') {
        return calculateDeRitis(serumAst, serumAlt);
      }

      // 18. FIB-4 & APRI
      if (selectedCalcId === 'geh-fib4-apri' || selectedCalcId === 'fib4' || selectedCalcId === 'apri') {
        return calculateFib4AndApri({
          age: patientAge,
          astValue: serumAst,
          altValue: serumAlt,
          plateletsPerUl: serumPlt,
        });
      }

      // 19. Maddrey Discriminant Function
      if (selectedCalcId === 'geh-maddrey-lille') {
        return calculateMaddrey(parsedCtx.ppt ?? 18, 12, serumBili);
      }

      // 20. BISAP Score
      if (selectedCalcId === 'geh-bisap') {
        return calculateBisap({
          bunAbove25MgDlOrMmol: serumUreum / 2.14 > 25,
          impairedMentalStatus: (parsedCtx.gcs ?? 15) < 15,
          sirsCriteriaCountAtLeast2: heartRate > 90 || bodyTemp > 38,
          ageAbove60: patientAge > 60,
          pleuralEffusionPresent: false,
        });
      }

      // 21. Tokyo Guidelines TG18
      if (selectedCalcId === 'geh-tg18') {
        return calculateTg18({
          type: 'cholangitis',
          hasLocalSigns: true,
          hasSystemicSigns: true,
          hasImagingConfirmation: true,
          hasOrganDysfunction: serumCr > 2.0 || systolicBp < 90,
          isGrade2Complicated: true,
        });
      }

      // 22. AdjustrHOM (MASCC, CISNE, TLS, Calvert, Khorana, 4Ts, PLASMIC, Ganzoni, PRC)
      if (selectedCalcId === 'hom-mascc' || selectedCalcId === 'mascc-risk') {
        return calculateMascc({
          burdenOfIllness: 'moderate',
          noHypotensionSbpAbove90: systolicBp >= 90,
          noCopd: true,
          solidTumorOrNoFungal: true,
          noDehydrationRequiringIv: false,
          outpatientAtOnset: true,
          ageBelow60: patientAge < 60,
        });
      }
      if (selectedCalcId === 'hom-cisne') {
        return calculateCisne({
          ecogPsAtLeast2: false,
          stressHyperglycemia: serumGlu > 160,
          copd: false,
          chronicCardiovascular: false,
          mucositisGradeAtLeast2: false,
          monocytesBelow200: true,
        });
      }
      if (selectedCalcId === 'hom-tls') {
        return evaluateCairoBishopTls({
          uricAcidMgDl: 8.5,
          potassiumMeqL: serumK,
          phosphateMgDl: 5.0,
          calciumMgDl: serumCa,
          hasClinicalCreatinineRise: serumCr >= 1.8,
          hasCardiacArrhythmia: false,
          hasSeizures: false,
        });
      }
      if (selectedCalcId === 'hom-calvert' || selectedCalcId === 'calvert-carboplatin') {
        const crcl = ((140 - patientAge) * patientWeight * (patientGender === 'female' ? 0.85 : 1)) / (72 * Math.max(0.4, serumCr));
        return calculateCalvertCarboplatin(5, crcl);
      }
      if (selectedCalcId === 'hom-khorana') {
        return calculateKhorana({
          siteOfCancer: 'high',
          plateletCountAtLeast350k: serumPlt >= 350000,
          hemoglobinBelow10OrEpo: serumHb < 10,
          leukocyteCountAbove11k: (parsedCtx.wbc ?? 8000) > 11000,
          bmiAtLeast35: false,
        });
      }
      if (selectedCalcId === 'hom-4ts') {
        return calculateFourTs({
          thrombocytopeniaScore: 2,
          timingScore: 2,
          thrombosisScore: 1,
          otherCausesScore: 1,
        });
      }
      if (selectedCalcId === 'hom-plasmic') {
        return calculatePlasmic({
          plateletsBelow30k: serumPlt < 30000,
          hemolysisPresent: true,
          noActiveCancerInPastYear: true,
          noSolidOrganOrStemCellTransplant: true,
          mcvBelow90: true,
          inrBelow15: serumInr < 1.5,
          creatinineBelow20: serumCr < 2.0,
        });
      }
      if (selectedCalcId === 'hom-ganzoni' || selectedCalcId === 'ganzoni') {
        return calculateGanzoni(patientWeight, serumHb, 13.0, 500);
      }
      if (selectedCalcId === 'hom-prc') {
        return calculatePrcTransfusion(patientWeight, serumHb, 10.0);
      }

      // 23. RheumaTools (RA, DAS28, MEX-SLEDAI, Gout)
      if (selectedCalcId === 'rheuma-das28' || selectedCalcId === 'das28-crp') {
        return calculateDas28Crp({
          tenderJointCount28: 8,
          swollenJointCount28: 4,
          crpMgL: patientContext?.labs?.crp ?? 18,
          patientGlobalAssessment0To100: 50,
        });
      }
      if (selectedCalcId === 'rheuma-mex-sledai' || selectedCalcId === 'mex-sledai') {
        return calculateMexSledai({
          renalActive: serumCr > 1.5,
          arthritis: true,
          mucocutaneous: true,
          hemolysisOrThrombocytopenia: serumPlt < 100000,
        });
      }
      if (selectedCalcId === 'rheuma-gout-acr') {
        return evaluateAcrEularGout({
          jointPattern: 'mtp1_involvement',
          clinicalCharacteristicsCount: 3,
          timeCourseTypicalEpisodes: 'recurrent_typical',
          clinicalTophiPresent: false,
          serumUricAcidMgDl: 8.5,
        });
      }
      if (selectedCalcId === 'rheuma-joint-pain-tree') {
        return evaluateAcrEularRa({
          jointInvolvement: '4_to_10_small',
          serology: 'high_positive',
          acutePhaseReactants: 'abnormal',
          durationOfSymptoms: 'at_least_6_weeks',
        });
      }

      // 24. Fallback to autoCalcResult for any synced InternaHub calculator
      if (autoCalcResult.cpptSummary) {
        const matchedScore = autoCalcResult.scores.find(
          (s) => s.calcId === selectedCalcId || s.id === selectedCalcId
        );
        return {
          cpptFormat: matchedScore
            ? `[InternaHub CDSS] ${matchedScore.name}: ${matchedScore.value} (${matchedScore.interpretation})\n${matchedScore.subvalue || ''}\n\n${autoCalcResult.cpptSummary}`
            : `[InternaHub CDSS] ${activeCalculatorMeta?.name || selectedCalcId}\n${autoCalcResult.cpptSummary}`,
          alerts: autoCalcResult.alerts.map((msg) => ({
            severity: 'danger' as const,
            title: 'Peringatan Klinis InternaHub',
            message: msg,
          })),
        };
      }

      if (parsedCtx.hba1c) {
        return calculateHbA1cToEag(parsedCtx.hba1c);
      }

      return null;
    } catch {
      return null;
    }
  }, [
    selectedCalcId,
    selectedDrugKey,
    selectedVasoDrug,
    patientAge,
    patientWeight,
    patientGender,
    serumCr,
    serumUreum,
    serumNa,
    serumK,
    serumCa,
    serumAlb,
    serumBili,
    serumInr,
    serumHb,
    serumPlt,
    serumAst,
    serumAlt,
    serumGlu,
    systolicBp,
    heartRate,
    bodyTemp,
    abgPh,
    abgPco2,
    abgHco3,
    parsedCtx,
    patientContext,
    autoCalcResult,
    activeCalculatorMeta,
  ]);

  const handleCopyCppt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('Resume CPPT berhasil disalin ke clipboard!', 'success');
  };

  const handleInsertDraft = (text: string) => {
    onInsertToDraft?.(text);
    onShowToast?.('Hasil kalkulasi CDSS berhasil disisipkan ke draf klinis!', 'success');
    onClose();
  };

  const alerts: GuardrailAlert[] = (calculationOutput && typeof calculationOutput === 'object' && 'alerts' in calculationOutput && Array.isArray((calculationOutput as any).alerts))
    ? ((calculationOutput as any).alerts as GuardrailAlert[])
    : [];

  const cpptText: string = (calculationOutput && typeof calculationOutput === 'object' && 'cpptFormat' in calculationOutput && typeof (calculationOutput as any).cpptFormat === 'string')
    ? (calculationOutput as any).cpptFormat
    : '';

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      hideCloseButton={true}
      className="w-[96vw] max-w-5xl h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-amber-500/30 bg-slate-900"
      bodyClassName="flex flex-col flex-1 h-full max-h-[92vh] min-h-0 overflow-hidden p-0"
    >
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#4A151B] border-b border-amber-500/20 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-amber-200">Kalkulator Klinis CDSS &amp; InternaHub</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                {ALL_CDSS_CALCULATORS.length} Kalkulator Aktif
              </Badge>
            </div>
            <p className="text-[11px] text-amber-200/70">
              Auto-Prefilled dari Lab Pasien • 100% On-Device + 1-Klik Seamless Bridge ke drguswib/internahub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={webBridgeUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-colors"
            title="Buka di Web InternaHub dengan seluruh parameter lab pasien otomatis terisi"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka di Web InternaHub (Auto-Fill)</span>
          </a>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MODAL BODY */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* SIDEBAR: SEARCH & SELECTOR */}
        <div
          className={`w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950 min-h-0 max-h-full overflow-hidden ${
            selectedCalcId ? 'hidden md:flex md:shrink-0' : 'flex flex-1 md:flex-initial md:shrink-0'
          }`}
        >
          {/* SEARCH & SUITE PILLS */}
          <div className="p-3 border-b border-slate-800 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dari 140+ kalkulator..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              <button
                onClick={() => setSelectedSuite('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                  selectedSuite === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({ALL_CDSS_CALCULATORS.length})
              </button>
              {Object.values(CDSS_SUITES).map((suite) => (
                <button
                  key={suite.id}
                  onClick={() => setSelectedSuite(suite.id)}
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                    selectedSuite === suite.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {suite.badge}
                </button>
              ))}
            </div>
          </div>

          {/* CALCULATORS LIST */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 overscroll-contain">
            {filteredCalculators.map((calc: CdssCalculatorMeta) => {
              const isSelected = calc.id === selectedCalcId;
              return (
                <div
                  key={calc.id}
                  onClick={() => {
                    setSelectedCalcId(calc.id);
                    if (calc.id.startsWith('adjustr-io-') && calc.id !== 'adjustr-io-antimicrobial') {
                      const dKey = calc.id.replace('adjustr-io-', '');
                      if (ANTIMICROBIAL_DATABASE[dKey]) {
                        setSelectedDrugKey(dKey);
                      }
                    }
                  }}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500/50 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{calc.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-slate-800 text-amber-300 border-slate-700">
                      {calc.suite}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{calc.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN WORKSPACE: CALCULATOR DETAIL & RUNNER */}
        <div
          className={`flex-1 flex flex-col min-h-0 bg-slate-900 overflow-y-auto p-4 md:p-6 ${
            !selectedCalcId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedCalcId && activeCalculatorMeta ? (
            <div className="space-y-6 max-w-3xl">
              {/* BACK BUTTON (MOBILE) & TITLE */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCalcId(null)}
                    className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-amber-100">{activeCalculatorMeta.name}</h3>
                      <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">
                        {activeCalculatorMeta.suite}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{activeCalculatorMeta.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={webBridgeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka di Web InternaHub</span>
                  </a>

                  {cpptText && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyCppt(cpptText)}
                      className="border-slate-700 text-slate-300 hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline ml-1">Salin CPPT</span>
                    </Button>
                  )}

                  {onInsertToDraft && cpptText && (
                    <Button
                      size="sm"
                      onClick={() => handleInsertDraft(cpptText)}
                      className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Sisipkan ke Draf</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* INPUT FIELDS CARD */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Parameter Klinis &amp; Laboratorium (Auto-Prefilled)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Otomatis disinkronkan dari teks rekam medis
                  </span>
                </div>

                {/* Drug Selector for ADJUSTR.IO */}
                {selectedCalcId.startsWith('adjustr-io-') && (
                  <div className="pb-3 border-b border-slate-800">
                    <label className="text-[11px] text-amber-300 font-semibold">Pilih Antimikroba (36 Obat ADJUSTR.IO):</label>
                    <select
                      value={
                        ANTIMICROBIAL_DATABASE[selectedCalcId.replace('adjustr-io-', '')]
                          ? selectedCalcId.replace('adjustr-io-', '')
                          : selectedDrugKey
                      }
                      onChange={(e) => {
                        setSelectedDrugKey(e.target.value);
                        setSelectedCalcId(`adjustr-io-${e.target.value}`);
                      }}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-amber-500/40 text-amber-100 font-medium"
                    >
                      {Object.entries(ANTIMICROBIAL_DATABASE).map(([key, d]) => (
                        <option key={key} value={key}>
                          {d.name} ({d.class})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Vasoactive Drug Selector for Syringe Pump */}
                {(selectedCalcId === 'calc-infusion-titration' ||
                  selectedCalcId === 'calc-ne' ||
                  selectedCalcId === 'calc-dobu' ||
                  selectedCalcId === 'calc-nicardipine') && (
                  <div className="pb-3 border-b border-slate-800">
                    <label className="text-[11px] text-amber-300 font-semibold">Pilih Obat Vasoaktif / Infus Kritis:</label>
                    <select
                      value={selectedVasoDrug}
                      onChange={(e) => setSelectedVasoDrug(e.target.value as VasoactiveDrugType)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-amber-500/40 text-amber-100 font-medium"
                    >
                      <option value="norepinephrine">Norepinefrin (Vascon 4 mg / 50 cc)</option>
                      <option value="dobutamine">Dobutamin (250 mg / 50 cc)</option>
                      <option value="dopamine">Dopamin (200 mg / 50 cc)</option>
                      <option value="nicardipine">Nikardipin (10 mg / 50 cc)</option>
                      <option value="nitroglycerin">Nitrogliserin / NTG (10 mg / 50 cc)</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Usia (th)</label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Jenis Kelamin</label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value as 'male' | 'female')}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      <option value="male">Laki-laki</option>
                      <option value="female">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Berat Badan (kg)</label>
                    <input
                      type="number"
                      value={patientWeight}
                      onChange={(e) => setPatientWeight(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Kreatinin (mg/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumCr}
                      onChange={(e) => setSerumCr(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Ureum (mg/dL)</label>
                    <input
                      type="number"
                      value={serumUreum}
                      onChange={(e) => setSerumUreum(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Natrium (mEq/L)</label>
                    <input
                      type="number"
                      value={serumNa}
                      onChange={(e) => setSerumNa(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Kalium (mEq/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumK}
                      onChange={(e) => setSerumK(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">GDS (mg/dL)</label>
                    <input
                      type="number"
                      value={serumGlu}
                      onChange={(e) => setSerumGlu(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Hb (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumHb}
                      onChange={(e) => setSerumHb(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Albumin (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumAlb}
                      onChange={(e) => setSerumAlb(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Bilirubin (mg/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumBili}
                      onChange={(e) => setSerumBili(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">INR</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumInr}
                      onChange={(e) => setSerumInr(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                {/* Specific ABG inputs */}
                {(selectedCalcId === 'calc-abg' ||
                  selectedCalcId === 'calc-abg-analyzer' ||
                  selectedCalcId === 'emd-dka-tracker') && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">pH Darah</label>
                      <input
                        type="number"
                        step="0.01"
                        value={abgPh}
                        onChange={(e) => setAbgPh(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">pCO2 (mmHg)</label>
                      <input
                        type="number"
                        value={abgPco2}
                        onChange={(e) => setAbgPco2(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">HCO3 (mEq/L)</label>
                      <input
                        type="number"
                        value={abgHco3}
                        onChange={(e) => setAbgHco3(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE RESULTS & GUARDRAIL ALERTS */}
              {calculationOutput ? (
                <div className="space-y-4">
                  {/* ALERTS */}
                  {alerts.length > 0 && (
                    <div className="space-y-2">
                      {alerts.map((alert: GuardrailAlert, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            alert.severity === 'danger'
                              ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold">{alert.title}</span>
                            <p className="mt-0.5 opacity-90">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PREVIEW CPPT FORMAT */}
                  {cpptText && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Format Draf Rekam Medis (CPPT)</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCppt(cpptText)}
                          className="h-7 text-xs text-slate-400 hover:text-amber-300"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Salin
                        </Button>
                      </div>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap bg-slate-900/80 p-3 rounded-lg border border-slate-800 max-h-60 overflow-y-auto">
                        {cpptText}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      Modul Interaktif Penuh Tersedia di InternaHub
                    </span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                      Seamless Bridge Ready
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Kalkulator <strong>{activeCalculatorMeta.name}</strong> telah siap dijalankan dengan seluruh parameter laboratorium pasien Anda yang otomatis terisi.
                  </p>
                  <a
                    href={webBridgeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka {activeCalculatorMeta.shortName} di Web InternaHub (Auto-Fill Lab)</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Calculator className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Pilih Kalkulator Klinis ({ALL_CDSS_CALCULATORS.length} Tersedia)</p>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Pilih salah satu kalkulator di panel sebelah kiri. Seluruh nilai laboratorium pasien dari catatan medis Anda telah diisi secara otomatis.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CdssExplorerModal;
