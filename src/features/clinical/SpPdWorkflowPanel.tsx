import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Database,
  Eye,
  FileCheck,
  FlaskConical,
  HeartPulse,
  Loader2,
  MousePointerClick,
  Pill,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  X,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  InternalMedicineEngine,
  type SpPdConsultResult,
  type SpPdPomrResult,
  type SpPdSummaryResult,
  type ClinicalSafetyReport,
  type SurgicalUrgencyType,
  type OperativeToleranceStatus,
} from '../../services/clinical/internalMedicineEngine';
import { insertTextToActiveField } from '../../services/emr/fieldInjector';
import {
  type CloudSynthesizerMode,
  type CloudSynthesizerResult,
  type CloudSynthesizerStatus,
  type GeminiProblem,
  type EvaluasiPreoperatif,
  isCloudSynthesizerAvailable,
  runCloudSynthesizer,
} from '../../services/clinical/cloudSynthesizer';
import {
  formatAriscatLine,
  formatRcriLine,
  formatImproveLine,
  formatCapriniLine,
  CONSENSUS_OPTIMAL_CONDITIONS,
} from '../../services/clinical/protocols';
import {
  computeFastCacheKey,
  getCachedSynthesis,
  setCachedSynthesis,
} from '../../services/clinical/clinicalCache';
import {
  convertOncologyDiagnosis,
  isOncologyText,
  type OncologyConversionResult,
} from '../../services/clinical/oncologyStagingEngine';
import { SAMPLE_ONKOLOGI_KOLOREKTAL } from '../clinical/OncologyConverterCard';

export interface SpPdWorkflowPanelProps {
  inputText: string;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onApplySample?: (sampleText: string) => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sample Presets for Sp.PD Scenarios
// ──────────────────────────────────────────────────────────────────────────────

export const SAMPLE_ELEKTIF_CRITICAL = `Konsul TS Bedah Saraf: Rencana operasi elektif kraniotomi evakuasi lesi intrakranial kronis pada pasien laki-laki 65 tahun.
Keluhan: Nyeri kepala kronik, riwayat stroke iskemik 1 tahun lalu.
RPO: Levofloxacin 1x750mg drip, Ondansetron 3x8mg IV, Aspirin 1x80mg, Metformin 2x500mg.
Pemeriksaan Fisik: TD 170/100 mmHg, HR 78 x/m, RR 20 x/m, Suhu 37.0 C, SpO2 98%.
Hasil Laboratorium:
- Kalium: 1.87 mEq/L (Hipokalemia Berat Simptomatik)
- Trombosit: 54.000 /uL (Trombositopenia Signifikan)
- Ureum: 68 mg/dL, Kreatinin: 2.1 mg/dL
- SGOT: 135 U/L, SGPT: 142 U/L
- GDS: 185 mg/dL
Mohon evaluasi toleransi operasi elektif dan persiapan perioperatif dari TS Penyakit Dalam.`;

export const SAMPLE_LIFE_SAVING_EMERGENCY = `KONSUL CITO TS BEDAH SARAF: Pasien laki-laki 65 tahun pro KRANIOTOMI DEKOMPRESI CITO / LIFE-SAVING ec Ruptur Aneurisma Serebri & Herniasi Intrakranial.
Saat ini di IGD: Penurunan kesadaran GCS E2M4V2, TD 195/115 mmHg, HR 58 x/m, Suhu 38.2 C, SpO2 94%.
Hasil Laboratorium CITO:
- Kalium: 1.87 mEq/L (Hipokalemia Berat Simptomatik)
- Trombosit: 54.000 /uL (Trombositopenia Signifikan)
- Ureum: 78 mg/dL, Kreatinin: 2.3 mg/dL
- GDS: 280 mg/dL
RPO: Ondansetron 8mg, Levofloxacin drip, Candesartan.
Tindakan operasi cito darurat harus segera masuk kamar operasi untuk pencegahan fatalitas langsung. Mohon pendampingan dan stabilisasi simultan dari TS Sp.PD.`;

export const SAMPLE_COMORBID_WARD = `Pasien wanita 58 tahun dirawat di bangsal dengan Kolesistitis Akut dan Pielonefritis.
RPD: DM tipe 2 dan Hipertensi grade 2.
RPO: Paracetamol 3x1000mg, Metformin 3x500mg, Candesartan 1x16mg, Levofloxacin 1x750mg.
Pemeriksaan Fisik: TD 160/95 mmHg, HR 92 x/m, RR 20 x/m, Suhu 38.5 C, SpO2 97%.
Laboratorium:
- Hb: 10.8 g/dL, Leukosit: 16.500 /uL, Trombosit: 210.000 /uL
- GDS: 240 mg/dL, HbA1c: 8.5%
- Ureum: 58 mg/dL, Kreatinin: 1.9 mg/dL
- SGOT: 85 U/L, SGPT: 98 U/L
- Kalium: 3.2 mEq/L, Natrium: 135 mEq/L`;

// Backward-compatible alias exports for ClinicalServiceTab
export const SAMPLE_PREOP_CONSUL = SAMPLE_ELEKTIF_CRITICAL;
export const SAMPLE_AKUT_CONSUL = SAMPLE_LIFE_SAVING_EMERGENCY;
export const SAMPLE_RABER_CONSUL = SAMPLE_COMORBID_WARD;

export const SpPdWorkflowPanel: React.FC<SpPdWorkflowPanelProps> = ({
  inputText,
  onShowToast,
  onApplySample,
}) => {
  // ── Clinical state ──────────────────────────────────────────────────────────
  const [surgicalUrgency, setSurgicalUrgency] = useState<SurgicalUrgencyType>('elektif');
  const [expandedProblem, setExpandedProblem] = useState<number | null>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Streamlined 2-tab focus: 'konsul' | 'pomr'
  const [activeColumn, setActiveColumn] = useState<'konsul' | 'pomr'>('konsul');
  const [showGroundingAccordion, setShowGroundingAccordion] = useState<boolean>(false);
  const [showEmrPreview, setShowEmrPreview] = useState<boolean>(false);

  // ── Cloud Synthesizer state ─────────────────────────────────────────────────
  const [cloudAvailable, setCloudAvailable] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSynthesizerStatus>('idle');
  const [cloudStatusDetail, setCloudStatusDetail] = useState<string>('');
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  
  // Results cache: keyed by `${mode}_${urgency}_${trimmedText}`
  const [cachedResults, setCachedResults] = useState<Record<string, CloudSynthesizerResult>>({});

  const cachedResultsRef = useRef(cachedResults);
  cachedResultsRef.current = cachedResults;

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if Gemini API Key is configured on mount
  useEffect(() => {
    isCloudSynthesizerAvailable()
      .then(setCloudAvailable)
      .catch(() => setCloudAvailable(false));
  }, []);

  // Compute live deterministic results using InternalMedicineEngine (<5ms)
  const consultResult: SpPdConsultResult = InternalMedicineEngine.generateConsultationAnswer(
    inputText,
    surgicalUrgency,
  );
  const pomrResult: SpPdPomrResult = InternalMedicineEngine.generatePomrNote(inputText);
  const summaryResult: SpPdSummaryResult = InternalMedicineEngine.generateCaseSummary(inputText);
  const safetyReport: ClinicalSafetyReport = InternalMedicineEngine.evaluateClinicalSafetyGuard(
    inputText,
    pomrResult.vitals,
    pomrResult.abnormalLabs,
    pomrResult.labTrends,
  );

  // Synchronous deterministic fast cache key
  const getCacheKey = useCallback(
    (mode: string, urgency: string, text: string) => {
      return computeFastCacheKey(mode, urgency, text);
    },
    [],
  );

  // Core Cloud synthesis runner
  const executeSynthesis = useCallback(
    async (
      mode: CloudSynthesizerMode,
      urgency: SurgicalUrgencyType,
      text: string,
      force = false,
    ) => {
      if (!text.trim()) {
        setCloudStatus('idle');
        setCloudStatusDetail('');
        setIsFromCache(false);
        return;
      }

      const key = getCacheKey(mode, urgency, text);

      // Check in-memory ref
      const existing = cachedResultsRef.current[key];
      if (!force && existing) {
        if (existing.ok) {
          setCloudStatus('done');
          setCloudStatusDetail('Dimuat dari memori lokal');
        } else {
          setCloudStatus('error');
          setCloudStatusDetail(existing.error ?? 'Gagal');
        }
        return;
      }

      // Check persistent storage (chrome.storage.local / localStorage)
      if (!force) {
        const stored = await getCachedSynthesis(key);
        if (stored && stored.ok) {
          cachedResultsRef.current[key] = stored;
          setCachedResults((prev) => ({ ...prev, [key]: stored }));
          setIsFromCache(true);
          setCloudStatus('done');
          setCloudStatusDetail('Dimuat dari cache lokal (hemat kuota API)');
          return;
        }
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setCloudStatus('sanitizing');
      setCloudStatusDetail('Sanitasi data lokal & grounding CROGE...');

      try {
        const result = await runCloudSynthesizer(text, {
          mode,
          surgicalUrgency: urgency,
          reidentify: true,
          signal: controller.signal,
          onStatus: (status, detail) => {
            setCloudStatus(status);
            setCloudStatusDetail(detail ?? '');
          },
        });

        if (!controller.signal.aborted) {
          cachedResultsRef.current[key] = result;
          setCachedResults((prev) => ({ ...prev, [key]: result }));
          setCloudStatus(result.ok ? 'done' : 'error');
          if (result.ok) {
            await setCachedSynthesis(key, result);
            setIsFromCache(false);
            onShowToast?.(`⚡ Gemini Unified Synthesizer selesai (${result.latencyMs}ms)`, 'success');
          } else {
            onShowToast?.(`Cloud fallback ke CROGE: ${result.error ?? 'Gagal'}`, 'warning');
          }
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setCloudStatus('error');
          setCloudStatusDetail(String(err));
        }
      }
    },
    [getCacheKey, onShowToast],
  );

  // Automated Cloud synthesis with persistent cache check & settled debounce
  useEffect(() => {
    if (!cloudAvailable || !inputText.trim()) {
      if (!cloudAvailable) {
        setCloudStatus('idle');
      }
      return;
    }

    let isSubscribed = true;
    const targetMode: CloudSynthesizerMode = activeColumn === 'konsul' ? 'konsul' : 'pomr';
    const key = getCacheKey(targetMode, surgicalUrgency, inputText);

    // 1. Check in-memory
    const existing = cachedResults[key];
    if (existing?.ok) {
      setCloudStatus('done');
      setCloudStatusDetail('');
      return;
    }

    // 2. Check persistent storage before scheduling API call
    getCachedSynthesis(key).then((stored) => {
      if (!isSubscribed) return;
      if (stored?.ok) {
        cachedResultsRef.current[key] = stored;
        setCachedResults((prev) => ({ ...prev, [key]: stored }));
        setIsFromCache(true);
        setCloudStatus('done');
        setCloudStatusDetail('Dimuat dari cache lokal (hemat kuota API)');
        return;
      }

      // 3. Cache miss: debounce 1200ms after user finishes input
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setIsFromCache(false);
        executeSynthesis(targetMode, surgicalUrgency, inputText);
      }, 1200);
    });

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    cloudAvailable,
    inputText,
    activeColumn,
    surgicalUrgency,
    executeSynthesis,
    getCacheKey,
    cachedResults,
  ]);

  // Current active mode cloud result & structured JSON
  const currentKey = getCacheKey(activeColumn, surgicalUrgency, inputText);
  const activeCloudResult = cachedResults[currentKey];
  const isCloudActiveAndDone = Boolean(cloudAvailable && activeCloudResult?.ok);
  const isCloudLoading =
    cloudAvailable &&
    (cloudStatus === 'sanitizing' ||
      cloudStatus === 'sending' ||
      cloudStatus === 'validating' ||
      cloudStatus === 'reidentifying');

  const structuredOutput = activeCloudResult?.structuredOutput;

  // Single source of truth for the copyable EMR summary
  const emrReadyText = useMemo(() => {
    if (activeColumn === 'konsul') {
      if (structuredOutput?.jawab_konsul?.trim()) {
        return structuredOutput.jawab_konsul.trim();
      }
      return consultResult.fullDraftText;
    }
    if (structuredOutput?.ringkasan_emr?.trim()) {
      return structuredOutput.ringkasan_emr.trim();
    }
    return summaryResult.fullDraftText || pomrResult.fullDraftText;
  }, [structuredOutput, activeColumn, consultResult.fullDraftText, summaryResult.fullDraftText, pomrResult.fullDraftText]);

  // Unified fallback pre-operative evaluation for Offline CROGE mode
  const unifiedEvaluasiPreop: EvaluasiPreoperatif = useMemo(() => {
    if (structuredOutput?.evaluasi_preoperatif) {
      return structuredOutput.evaluasi_preoperatif;
    }

    const rcriScore = consultResult.riskStratification.rcriLeeScore;
    const rcriLevel = rcriScore >= 2 ? 'high' : rcriScore === 1 ? 'moderate' : 'low';
    const rcriText = formatRcriLine(rcriScore).replace(/^.*?\((.*?)\)$/, '$1');

    const ariscatVal = consultResult.riskStratification.ariscatScore ?? 33;
    const ariscatLevel = ariscatVal >= 45 ? 'high' : ariscatVal >= 26 ? 'moderate' : 'low';
    const ariscatText = formatAriscatLine(ariscatVal).replace(/^.*?\((.*?)\)$/, '$1');

    const improveVal = consultResult.riskStratification.improveBleedingScore ?? 3.5;
    const improveLevel = improveVal >= 7 ? 'high' : 'low';
    const improveText = formatImproveLine(improveVal).replace(/^.*?\((.*?)\)$/, '$1');

    const capriniVal = consultResult.riskStratification.capriniScore ?? 15;
    const capriniLevel = capriniVal >= 5 ? 'high' : capriniVal >= 3 ? 'moderate' : 'low';
    const capriniText = formatCapriniLine(capriniVal).replace(/^.*?\((.*?)\)$/, '$1');

    return {
      status_toleransi: consultResult.toleranceStatus,
      risiko_tindakan: [
        {
          nama_skor: 'ARISCAT score',
          poin: `${ariscatVal} points`,
          interpretasi: ariscatText,
          level_risiko: ariscatLevel,
        },
        {
          nama_skor: 'Revised Cardiac Risk Index',
          poin: `${rcriScore} point`,
          interpretasi: rcriText,
          level_risiko: rcriLevel,
        },
        {
          nama_skor: 'Improved bleeding risk score',
          poin: `${improveVal} points`,
          interpretasi: improveText,
          level_risiko: improveLevel,
        },
        {
          nama_skor: 'Caprini VTE score',
          poin: `${capriniVal} points`,
          interpretasi: capriniText,
          level_risiko: capriniLevel,
        },
      ],
      target_optimalisasi: [...CONSENSUS_OPTIMAL_CONDITIONS],
    };
  }, [structuredOutput, consultResult]);

  // Unified Hal yang Perlu Diperhatikan (Gemini or CROGE fallback)
  const unifiedHalPerluDiperhatikan = useMemo(() => {
    if (structuredOutput?.hal_perlu_diperhatikan && structuredOutput.hal_perlu_diperhatikan.length > 0) {
      return structuredOutput.hal_perlu_diperhatikan;
    }

    const items: string[] = [];
    if (safetyReport.hazards.length > 0) {
      for (const h of safetyReport.hazards) {
        items.push(`${h.title}: ${h.description}. Rekomendasi: ${h.recommendation}`);
      }
    }
    const criticalLabs = pomrResult.abnormalLabs.filter((l) => l.flag === 'critical');
    for (const cl of criticalLabs) {
      items.push(`Nilai Kritis ${cl.name}: ${cl.value} ${cl.unit} (${cl.interpretation}).`);
    }

    if (items.length === 0 && consultResult.toleranceReason) {
      items.push(consultResult.toleranceReason);
    }
    return items;
  }, [structuredOutput, safetyReport.hazards, pomrResult.abnormalLabs, consultResult.toleranceReason]);

  // Unified Problem list for POMR tab
  const unifiedProblems: GeminiProblem[] = useMemo(() => {
    if (structuredOutput?.problems && structuredOutput.problems.length > 0) {
      return structuredOutput.problems;
    }

    // Map CROGE problems into the same unified card format
    return pomrResult.problems.map((p) => {
      const urgensi: GeminiProblem['urgensi'] =
        p.criticality === 'critical'
          ? 'cito'
          : p.criticality === 'high'
            ? 'high'
            : p.criticality === 'medium'
              ? 'moderate'
              : 'routine';

      return {
        nama_masalah: p.title,
        divisi_papdi: p.divisionName,
        urgensi,
        clinical_reasoning: `Identifikasi masalah aktif berdasarkan temuan klinis, riwayat penyakit, serta data lab terkait divisi ${p.divisionName}.`,
        planning: {
          dx: p.pdx.join('; ') || 'Pemeriksaan penunjang sesuai indikasi klinis lanjutan',
          tx: p.ptx.join('; ') || 'Regimen terapi medikamentosa terstandar PAPDI/FORNAS',
          mx: p.pmx.join('; ') || 'Monitoring tanda vital ketat, produksi urin, dan evaluasi lab serial',
          ex: p.pex.join('; ') || 'Edukasi kondisi klinis, tujuan pengobatan, dan prognosis kepada keluarga',
        },
      };
    });
  }, [structuredOutput, pomrResult.problems]);

  // Oncology staging result — memoized from the same inputText, zero extra cost
  const oncologyResult: OncologyConversionResult | null = useMemo(() => {
    if (!isOncologyText(inputText)) return null;
    const r = convertOncologyDiagnosis(inputText);
    return r.isOncologyCase ? r : null;
  }, [inputText]);

  // Dynamic matching: find which problem card in unifiedProblems actually corresponds to the oncology diagnosis.
  // Never hardcode idx === 0 (prevents oncology widget from appearing on Nephrology/AKI or other problems).
  const oncologyProblemIndex = useMemo(() => {
    if (!oncologyResult || !unifiedProblems || unifiedProblems.length === 0) return -1;

    // 1. Match by division Hematologi-Onkologi or direct oncology keyword in problem title
    const matchByTitleOrDiv = unifiedProblems.findIndex((p) => {
      const isHematoOnco = /onkologi|hemato/i.test(p.divisi_papdi || '');
      const hasOncoKeyword = isOncologyText(p.nama_masalah || '');
      return isHematoOnco || hasOncoKeyword;
    });
    if (matchByTitleOrDiv !== -1) return matchByTitleOrDiv;

    // 2. Match by primary organ keyword (e.g. rektum, colon, mammae, paru) in problem title
    if (oncologyResult.organ && oncologyResult.organ !== 'unknown') {
      const organRegex = new RegExp(`\\b(?:${oncologyResult.organ}|${oncologyResult.organDisplay.replace(/[^\w\s]/g, '')})\\b`, 'i');
      const matchByOrgan = unifiedProblems.findIndex((p) => organRegex.test(p.nama_masalah));
      if (matchByOrgan !== -1) return matchByOrgan;
    }

    // 3. Fallback: match if clinical reasoning mentions oncology
    const matchByReasoning = unifiedProblems.findIndex((p) => isOncologyText(p.clinical_reasoning || ''));
    if (matchByReasoning !== -1) return matchByReasoning;

    return -1;
  }, [oncologyResult, unifiedProblems]);

  // Copy handler
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
    onShowToast?.(`Berhasil menyalin ${label} ke clipboard`, 'success');
  };

  // EMR Direct Field Injector
  const handleInject = async (text: string, label: string) => {
    const res = await insertTextToActiveField(text);
    if (res.success) {
      onShowToast?.(`Sukses memasukkan ${label} ke field aktif EMR/SIMRS!`, 'success');
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      onShowToast?.(
        res.error ?? `Gagal inject otomatis. ${label} telah disalin ke clipboard.`,
        'warning',
      );
    }
  };

  const handleForceRefresh = () => {
    if (!cloudAvailable) {
      onShowToast?.('Konfigurasi Google Gemini API Key di tab Settings untuk mengaktifkan Cloud.', 'info');
      return;
    }
    const targetMode: CloudSynthesizerMode = activeColumn === 'konsul' ? 'konsul' : 'pomr';
    executeSynthesis(targetMode, surgicalUrgency, inputText, true);
  };

  // Tolerance banner renderer
  const renderToleranceBanner = (status: OperativeToleranceStatus | string) => {
    if (status === 'TUNDA OPERASI ELEKTIF' || status === 'TUNDA OPERASI') {
      return (
        <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-600 text-rose-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <span className="font-extrabold text-xs tracking-wide text-rose-200 uppercase">
              TUNDA OPERASI ELEKTIF
            </span>
          </div>
          <p className="text-[11px] text-rose-200/90 leading-relaxed font-medium">
            {consultResult.toleranceReason}
          </p>
          <div className="mt-2 pt-2 border-t border-rose-800/80 flex items-center gap-1.5 text-[10px] text-rose-300 font-semibold">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>Target: Stabilisasi CITO pre-operatif sampai hemodinamik & lab terkontrol.</span>
          </div>
        </div>
      );
    }

    if (
      status === 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL' ||
      status.includes('CITO PARALEL')
    ) {
      return (
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950 via-orange-950 to-red-950 border border-orange-500 text-orange-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0" />
            <span className="font-extrabold text-xs tracking-wide text-orange-200 uppercase">
              PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL
            </span>
          </div>
          <p className="text-[11px] text-orange-200/90 leading-relaxed font-medium">
            {consultResult.toleranceReason}
          </p>
          <div className="mt-2 pt-2 border-t border-orange-800/80 flex items-center gap-1.5 text-[10px] text-orange-300 font-semibold">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span>Prinsip: Tidak ada penundaan. Koreksi dan resusitasi berjalan simultan di OK.</span>
          </div>
        </div>
      );
    }

    if (status === 'LAIK OPERASI DENGAN CATATAN' || status.includes('DENGAN CATATAN')) {
      return (
        <div className="p-3 rounded-xl bg-amber-900/40 border border-amber-500/80 text-amber-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-extrabold text-xs tracking-wide text-amber-300 uppercase">
              LAIK OPERASI DENGAN CATATAN
            </span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed font-medium">
            {consultResult.toleranceReason}
          </p>
        </div>
      );
    }

    return (
      <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-100 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-extrabold text-xs tracking-wide text-emerald-300 uppercase">
            LAIK OPERASI
          </span>
        </div>
        <p className="text-[11px] text-emerald-200/90 leading-relaxed font-medium">
          {consultResult.toleranceReason}
        </p>
      </div>
    );
  };

  // High-contrast Warning Card: Hal yang Perlu Diperhatikan
  const renderHalPerluDiperhatikan = (items: string[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50/70 to-rose-50/50 border-2 border-amber-400/90 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span className="font-extrabold text-xs tracking-tight uppercase">
              Hal yang Perlu Diperhatikan pada Kasus Ini
            </span>
          </div>
          <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
            {items.length} Poin Penting
          </span>
        </div>
        <ul className="space-y-1.5 pt-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[11px] text-amber-950">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-extrabold shrink-0 shadow-2xs">
                {idx + 1}
              </span>
              <span className="leading-snug font-medium">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Comprehensive Pre-operative Multi-Risk Stratification Card
  const renderEvaluasiPreop = (evaluasi: EvaluasiPreoperatif) => (
    <Card className="border border-maroon-200/90 shadow-sm bg-white overflow-hidden">
      <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-maroon-50/90 via-white to-gold-50/50 border-b border-maroon-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-maroon-800 shrink-0" />
            <div>
              <CardTitle className="text-xs font-extrabold text-maroon-950">
                Stratifikasi Risiko Tindakan Operatif
              </CardTitle>
              <p className="text-[10px] text-slate-500 font-normal">
                Multi-Risk Index: Kardiovaskular, Pulmonal, Perdarahan & Tromboemboli
              </p>
            </div>
          </div>
          <span className="text-[9.5px] px-2 py-0.5 rounded font-bold bg-maroon-100 text-maroon-900 border border-maroon-200">
            {evaluasi.status_toleransi}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {/* 4 Grid Mini-Cards for Risk Scores */}
        <div className="grid grid-cols-2 gap-2">
          {evaluasi.risiko_tindakan.map((r, idx) => {
            const colorMap = {
              low: 'bg-emerald-50/80 border-emerald-300 text-emerald-950',
              moderate: 'bg-amber-50/80 border-amber-300 text-amber-950',
              high: 'bg-orange-50/80 border-orange-400 text-orange-950',
              critical: 'bg-rose-50/80 border-rose-400 text-rose-950',
            };
            const badgeMap = {
              low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              moderate: 'bg-amber-100 text-amber-800 border-amber-300',
              high: 'bg-orange-100 text-orange-800 border-orange-300',
              critical: 'bg-rose-100 text-rose-800 border-rose-300',
            };

            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border ${colorMap[r.level_risiko] || colorMap.moderate} text-[10.5px] space-y-1 shadow-2xs transition-all`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-[10px] uppercase tracking-tight truncate text-slate-700">
                    {r.nama_skor}
                  </span>
                  <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${badgeMap[r.level_risiko] || badgeMap.moderate}`}>
                    {r.level_risiko}
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 leading-none">
                  {r.poin}
                </div>
                <p className="text-[10px] text-slate-700 leading-snug font-medium pt-0.5">
                  {r.interpretasi}
                </p>
              </div>
            );
          })}
        </div>

        {/* Target Optimalisasi Sebelum Tindakan */}
        {evaluasi.target_optimalisasi.length > 0 && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
            <div className="font-bold text-[10.5px] text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Optimal Dilakukan Tindakan Apabila:</span>
            </div>
            <ul className="space-y-1 pl-1">
              {evaluasi.target_optimalisasi.map((target, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[10.5px] text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-maroon-700 shrink-0 mt-1" />
                  <span className="leading-snug font-medium">{target}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3.5 select-text">
      {/* ── Top Bar: Header, Engine Status & Sticky Action Bar ── */}
      <div className="bg-gradient-to-r from-maroon-900 via-maroon-950 to-slate-900 p-2.5 rounded-xl border border-gold-600/40 shadow-sm text-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 border-b border-maroon-800/80">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-gold-400" />
            <span className="text-xs font-bold tracking-tight text-gold-200">
              Sp.PD Clinical Workflow (Problem-Centric)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Engine Status Badge */}
            {cloudAvailable ? (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] border transition-all ${
                  isCloudActiveAndDone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : isCloudLoading
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 animate-pulse'
                      : 'bg-slate-800/80 text-gold-300 border-gold-500/40'
                }`}
                title="Google Gemini AI aktif sebagai mesin penalaran utama dengan grounding CROGE lokal."
              >
                {isCloudLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-gold-400" />
                )}
                <span>
                  {isCloudLoading
                    ? 'Gemini Synthesizing...'
                    : isCloudActiveAndDone
                      ? `Gemini Unified (${activeCloudResult?.latencyMs}ms)`
                      : 'Gemini Cloud First'}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-800/80 text-amber-300 border border-amber-500/40"
                title="Belum ada Gemini API Key. Berjalan dalam mode deterministik CROGE lokal."
              >
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span>Mode Offline (CROGE)</span>
              </div>
            )}

            {/* Sticky Action: Quick Preview & One-Click Copy to EMR */}
            <div className="flex items-center gap-1 pl-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEmrPreview(true)}
                className="h-6 px-1.5 text-[10px] bg-slate-800/90 text-gold-300 border-gold-500/50 hover:bg-slate-700 hover:text-gold-200"
                title="Lihat teks ringkasan lengkap siap salin ke EMR"
              >
                <Eye className="w-3 h-3 mr-0.5" />
                <span>Preview</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleCopy(emrReadyText, 'Ringkasan EMR')}
                className={`h-6 px-2 text-[10px] font-bold transition-all shadow-xs ${
                  copiedKey === 'Ringkasan EMR'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gold-500 hover:bg-gold-400 text-maroon-950 font-extrabold'
                }`}
                title="Salin ringkasan final format rekam medis bersih dalam satu klik"
              >
                {copiedKey === 'Ringkasan EMR' ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    <span>Salin ke EMR</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 text-[11px]">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3 text-gold-500" /> Muat Skenario:
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveColumn('konsul');
              setSurgicalUrgency('elektif');
              onApplySample?.(SAMPLE_ELEKTIF_CRITICAL);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500 transition-colors"
          >
            Operasi Elektif (K 1.87 & PLT 54k)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveColumn('konsul');
              setSurgicalUrgency('life_saving');
              onApplySample?.(SAMPLE_LIFE_SAVING_EMERGENCY);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-amber-900/60 text-slate-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500 transition-colors"
          >
            Operasi CITO (Life-Saving)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveColumn('pomr');
              onApplySample?.(SAMPLE_COMORBID_WARD);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-gold-900/60 text-slate-300 hover:text-gold-200 border border-slate-700 hover:border-gold-500 transition-colors"
          >
            Visite Bangsal (Polifarmasi)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveColumn('pomr');
              onApplySample?.(SAMPLE_ONKOLOGI_KOLOREKTAL);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-purple-900/80 hover:bg-purple-800/80 text-purple-200 hover:text-purple-100 border border-purple-600/60 hover:border-purple-400 transition-colors font-medium"
          >
            🔬 Onkologi Bedah (Ca. Rektum)
          </button>
        </div>
      </div>

      {/* ── 2 CLINICAL WORKFLOW TABS: KONSUL vs POMR ── */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveColumn('konsul')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeColumn === 'konsul'
              ? 'bg-white text-maroon-900 shadow-sm border border-maroon-200'
              : 'text-slate-500 hover:text-maroon-800 hover:bg-white/60'
          }`}
        >
          <FileCheck className="w-4 h-4 shrink-0 text-maroon-800" />
          <span>Jawab Konsul TS</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveColumn('pomr')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeColumn === 'pomr'
              ? 'bg-white text-maroon-900 shadow-sm border border-maroon-200'
              : 'text-slate-500 hover:text-maroon-800 hover:bg-white/60'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0 text-maroon-800" />
          <span>POMR CPPT Bangsal</span>
        </button>
      </div>

      {/* ── Active Tab Content ── */}
      <div className="space-y-3">
        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: LEMBAR JAWABAN KONSUL TS & PRE-OPERATIF
            ══════════════════════════════════════════════════════════════════════ */}
        {activeColumn === 'konsul' && (
          <div className="space-y-3">
            {/* Sakelar Biner Urgensi Prosedur: Elektif vs Life-Saving */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-slate-700 block">
                Evaluasi Urgensi Prosedur Bedah:
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSurgicalUrgency('elektif')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-all text-center ${
                    surgicalUrgency === 'elektif'
                      ? 'bg-white text-maroon-900 shadow-xs border border-slate-300/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Operasi Elektif Terencana
                </button>
                <button
                  type="button"
                  onClick={() => setSurgicalUrgency('life_saving')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-all text-center ${
                    surgicalUrgency === 'life_saving'
                      ? 'bg-gradient-to-r from-red-700 to-rose-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Operasi CITO / Life-Saving
                </button>
              </div>
            </div>

            {/* Banner Toleransi Operasi */}
            {renderToleranceBanner(unifiedEvaluasiPreop.status_toleransi)}

            {/* Hal yang Perlu Diperhatikan (Warning Card) */}
            {renderHalPerluDiperhatikan(unifiedHalPerluDiperhatikan)}

            {/* Stratifikasi Risiko Tindakan Operatif Multi-Score Card */}
            {renderEvaluasiPreop(unifiedEvaluasiPreop)}

            {/* Card: Draf Jawaban Konsul & Rekomendasi Sp.PD */}
            {(() => {
              const activeConsultDraft = structuredOutput?.jawab_konsul?.trim()
                ? structuredOutput.jawab_konsul
                : consultResult.fullDraftText;

              return (
                <Card className="border border-maroon-200/90 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-maroon-50/90 to-slate-50 border-b border-maroon-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-maroon-800 shrink-0" />
                      <div>
                        <CardTitle className="text-xs font-bold text-maroon-950 flex items-center gap-1.5">
                          <span>Draf Jawaban Konsul Sp.PD</span>
                          {isCloudActiveAndDone ? (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-gold-600" />
                              Gemini Unified
                            </span>
                          ) : (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              CROGE Deterministic
                            </span>
                          )}
                          {isFromCache && (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1" title="Hasil dimuat dari penyimpanan lokal tanpa memakai kuota API">
                              <Database className="w-2.5 h-2.5 text-sky-600" />
                              Cache Lokal
                            </span>
                          )}
                        </CardTitle>
                        <span className="text-[10px] text-slate-500">
                          Rekomendasi tertulis lengkap untuk TS Pemohon Konsul
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {cloudAvailable && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleForceRefresh}
                          className="h-6 px-1.5 text-[10px] text-slate-600 hover:text-slate-900"
                          title="Sintesis ulang dengan Gemini Cloud (Paksa)"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(activeConsultDraft, 'Jawaban Konsul')}
                        className="h-6 px-2 text-[10px] border-maroon-300 text-maroon-800 hover:bg-maroon-50"
                      >
                        {copiedKey === 'Jawaban Konsul' ? (
                          <Check className="w-3 h-3 text-emerald-600 mr-1" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1" />
                        )}
                        Salin Konsul
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleInject(activeConsultDraft, 'Jawaban Konsul')}
                        className="h-6 px-2 text-[10px] bg-maroon-800 hover:bg-maroon-900 text-white font-semibold"
                      >
                        <MousePointerClick className="w-3 h-3 mr-1 text-gold-400" />
                        Inject SIMRS
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 space-y-3">
                    {isCloudLoading && (
                      <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200 text-sky-800 space-y-2 animate-pulse">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                          <span>{cloudStatusDetail || 'Menyintesis draf jawaban konsul dengan Google Gemini AI...'}</span>
                        </div>
                        <div className="h-2.5 bg-sky-200/60 rounded w-3/4" />
                        <div className="h-2 bg-sky-100 rounded w-full" />
                      </div>
                    )}

                    {/* Formatted Complete Content Card */}
                    <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-[11.5px] text-slate-800 leading-relaxed font-sans whitespace-pre-wrap select-text">
                      {activeConsultDraft}
                    </div>

                    {/* Grounding Data & Lab Collapsible */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowGroundingAccordion((v) => !v)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 text-[10.5px] font-bold transition-colors border border-slate-200"
                      >
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-maroon-800" />
                          Data Grounding Klinis (Vitals, Lab, CKD-EPI)
                        </span>
                        {showGroundingAccordion ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>

                      {showGroundingAccordion && (
                        <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-[10.5px]">
                          <div className="font-bold text-slate-700">Tanda Vital:</div>
                          <div className="text-slate-600">
                            TD: {pomrResult.vitals.rawMatched.bp || 'Tidak tercatat'} | HR:{' '}
                            {pomrResult.vitals.heartRate || '-'} | RR:{' '}
                            {pomrResult.vitals.respiratoryRate || '-'} | Temp:{' '}
                            {pomrResult.vitals.temperature || '-'} °C
                          </div>
                          <div className="font-bold text-slate-700 pt-1">Hasil Lab Abnormal:</div>
                          <div className="space-y-1">
                            {pomrResult.abnormalLabs.length > 0 ? (
                              pomrResult.abnormalLabs.map((lab, i) => (
                                <div key={i} className="text-slate-600">
                                  • {lab.name}: {lab.value} {lab.unit} ({lab.flag}) — {lab.interpretation}
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-400 italic">Tidak ada lab abnormal signifikan</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: POMR CPPT BANGSAL (PROBLEM-CENTRIC & INTERACTIVE)
            ══════════════════════════════════════════════════════════════════════ */}
        {activeColumn === 'pomr' && (
          <div className="space-y-3">
            {/* Vitals Grid Strip */}
            <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="text-slate-400 text-[9px] font-bold">TD</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {pomrResult.vitals.rawMatched.bp || '-'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="text-slate-400 text-[9px] font-bold">HR</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {pomrResult.vitals.rawMatched.hr || '-'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="text-slate-400 text-[9px] font-bold">RR</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {pomrResult.vitals.rawMatched.rr || '-'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="text-slate-400 text-[9px] font-bold">Suhu</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {pomrResult.vitals.rawMatched.temp || '-'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="text-slate-400 text-[9px] font-bold">SpO2</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {pomrResult.vitals.rawMatched.spo2 || '-'}
                </div>
              </div>
            </div>

            {/* Hal yang Perlu Diperhatikan */}
            {renderHalPerluDiperhatikan(unifiedHalPerluDiperhatikan)}

            {/* Main Problem Cards Container */}
            <Card className="border border-maroon-200/90 shadow-sm bg-white overflow-hidden">
              <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-maroon-50/90 via-white to-gold-50/40 border-b border-maroon-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-maroon-800 shrink-0" />
                  <div>
                    <CardTitle className="text-xs font-bold text-maroon-950 flex items-center gap-1.5">
                      <span>Daftar Masalah Aktif &amp; Perencanaan 4P</span>
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded font-extrabold bg-maroon-100 text-maroon-900 border border-maroon-200">
                        {unifiedProblems.length} Masalah
                      </span>
                    </CardTitle>
                    <span className="text-[10px] text-slate-500">
                      Format POMR PAPDI: Problem Statement, Reasoning, Dx, Tx, Mx, Ex
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(emrReadyText, 'POMR CPPT')}
                    className="h-6 px-2 text-[10px] border-maroon-300 text-maroon-800 hover:bg-maroon-50"
                  >
                    {copiedKey === 'POMR CPPT' ? (
                      <Check className="w-3 h-3 text-emerald-600 mr-1" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    Salin POMR
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleInject(emrReadyText, 'POMR CPPT')}
                    className="h-6 px-2 text-[10px] bg-maroon-800 hover:bg-maroon-900 text-white font-semibold"
                  >
                    <MousePointerClick className="w-3 h-3 mr-1 text-gold-400" />
                    Inject SIMRS
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-3 space-y-2.5">
                {isCloudLoading && (
                  <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200 text-sky-800 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                      <span>{cloudStatusDetail || 'Menyusun daftar masalah dan rencana 4P dengan Gemini AI...'}</span>
                    </div>
                    <div className="h-2.5 bg-sky-200/60 rounded w-3/4" />
                    <div className="h-2 bg-sky-100 rounded w-full" />
                  </div>
                )}

                {/* Standalone Fallback Oncology Widget if no problem card matched Hematologi-Onkologi */}
                {oncologyResult && oncologyProblemIndex === -1 && (() => {
                  const onco = oncologyResult;
                  return (
                    <div className="rounded-xl border border-purple-200 overflow-hidden bg-gradient-to-r from-purple-50/70 via-white to-maroon-50/40 p-3 shadow-2xs space-y-2.5">
                      <div className="flex items-center gap-1.5 justify-between flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                          <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-widest">
                            Staging Onkologi Bedah → Sp.PD
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            AJCC 8th Ed. · 100% On-Device
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(onco.diagnosisOneLiner, 'Diagnosis Onkologi')}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold transition-all ${
                            copiedKey === 'Diagnosis Onkologi'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                          }`}
                        >
                          {copiedKey === 'Diagnosis Onkologi' ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                          Salin Dx
                        </button>
                      </div>

                      {/* TNM chips row */}
                      {onco.tnm && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">TNM:</span>
                          {[onco.tnm.rawT, onco.tnm.rawN, onco.tnm.rawM].map((d, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded border font-mono font-bold text-[10.5px] bg-slate-100 text-slate-800 border-slate-300"
                            >
                              {i === 0 && onco.tnm?.prefix ? `${onco.tnm.prefix}${d}` : d}
                            </span>
                          ))}
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          {onco.ajccStage && (
                            <span className={`px-2 py-0.5 rounded-full border font-extrabold text-[10.5px] ${
                              onco.ajccStage.stage.startsWith('IV')
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : onco.ajccStage.stage.startsWith('III')
                                  ? 'bg-orange-100 text-orange-900 border-orange-300'
                                  : onco.ajccStage.stage.startsWith('II')
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-sky-100 text-sky-900 border-sky-300'
                            }`}>
                              {onco.ajccStage.stageRoman}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Diagnosis one-liner box */}
                      <div className="p-2.5 rounded-lg bg-maroon-50/70 border border-maroon-200/70">
                        <div className="text-[9.5px] font-extrabold text-maroon-800 uppercase tracking-wide mb-1">
                          Diagnosis Utama (Format Sp.PD):
                        </div>
                        <div className="text-[11.5px] font-bold text-maroon-950 leading-snug select-all">
                          {onco.diagnosisOneLiner}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Individual Collapsible Problem Cards */}
                {unifiedProblems.map((problem, idx) => {
                  const isExpanded = expandedProblem === idx;

                  const urgensiBadge = {
                    cito: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse',
                    high: 'bg-orange-100 text-orange-800 border-orange-300 font-bold',
                    moderate: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
                    routine: 'bg-slate-100 text-slate-700 border-slate-200',
                  }[problem.urgensi] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs transition-all"
                    >
                      {/* Problem Header Button */}
                      <button
                        type="button"
                        onClick={() => setExpandedProblem(isExpanded ? null : idx)}
                        className="w-full p-2.5 text-left flex items-start justify-between gap-2 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-maroon-900 text-xs">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-xs leading-snug">
                              {problem.nama_masalah}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[9.5px]">
                            <span
                              className={`px-2 py-0.5 rounded font-bold border ${
                                /saraf|neuro/i.test(problem.divisi_papdi)
                                  ? 'bg-violet-100 text-violet-900 border-violet-300'
                                  : /bedah/i.test(problem.divisi_papdi)
                                    ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300'
                                    : /lintas|eksternal|luar/i.test(problem.divisi_papdi)
                                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                                      : /hemato|onkologi/i.test(problem.divisi_papdi)
                                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {problem.divisi_papdi}
                            </span>
                            <span className={`px-2 py-0.5 rounded uppercase border ${urgensiBadge}`}>
                              {problem.urgensi}
                            </span>
                            {/* Oncology: inline AJCC stage + ECOG badges (bound dynamically to matching oncology card) */}
                            {idx === oncologyProblemIndex && oncologyResult && oncologyResult.ajccStage && (
                              <span className={`px-2 py-0.5 rounded-full border font-extrabold ${
                                oncologyResult.ajccStage.stage.startsWith('IV')
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : oncologyResult.ajccStage.stage.startsWith('III')
                                    ? 'bg-orange-100 text-orange-900 border-orange-300'
                                    : oncologyResult.ajccStage.stage.startsWith('II')
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-sky-100 text-sky-900 border-sky-300'
                              }`}>
                                {oncologyResult.ajccStage.stageRoman}
                              </span>
                            )}
                            {idx === oncologyProblemIndex && oncologyResult && oncologyResult.ecog.score !== null && (
                              <span className={`px-2 py-0.5 rounded-full border font-bold ${
                                oncologyResult.ecog.score <= 1
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : oncologyResult.ecog.score === 2
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : oncologyResult.ecog.score === 3
                                      ? 'bg-orange-100 text-orange-900 border-orange-300'
                                      : 'bg-rose-100 text-rose-900 border-rose-300'
                              }`}>
                                {oncologyResult.ecog.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Quick Salin Diagnosis Saja — only for oncology problem card */}
                          {idx === oncologyProblemIndex && oncologyResult && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(oncologyResult.diagnosisOneLiner, 'Diagnosis Onkologi');
                              }}
                              title="Salin 1 baris diagnosis onkologi untuk kolom Asesmen/Diagnosis EMR"
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold transition-all ${
                                copiedKey === 'Diagnosis Onkologi'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                              }`}
                            >
                              {copiedKey === 'Diagnosis Onkologi'
                                ? <Check className="w-2.5 h-2.5" />
                                : <Copy className="w-2.5 h-2.5" />
                              }
                              Salin Dx
                            </button>
                          )}
                          <div className="p-1 text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Problem Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-white space-y-0 text-[11px]">
                          {/* Clinical Reasoning Section */}
                          <div className="p-3 bg-slate-50/90 border-b border-slate-100 space-y-1">
                            <div className="text-[10px] font-extrabold text-maroon-950 uppercase tracking-tight flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-gold-600" />
                              <span>Clinical Reasoning &amp; Evidensi Penunjang:</span>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                              {problem.clinical_reasoning}
                            </p>
                          </div>

                          {/* ── Embedded Oncology Staging Widget (dynamically bound to oncology card) ── */}
                          {idx === oncologyProblemIndex && oncologyResult && (() => {
                            const onco = oncologyResult;
                            return (
                              <div className="border-b border-purple-100 bg-gradient-to-r from-purple-50/60 via-white to-maroon-50/30 space-y-2.5 p-3">
                                {/* Mini header */}
                                <div className="flex items-center gap-1.5">
                                  <FlaskConical className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                  <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-widest">
                                    Staging Onkologi Bedah → Sp.PD
                                  </span>
                                  <span className="ml-auto text-[9px] text-slate-400 font-medium">
                                    AJCC 8th Ed. · 100% On-Device
                                  </span>
                                </div>

                                {/* TNM chips row */}
                                {onco.tnm && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">TNM:</span>
                                    {[onco.tnm.rawT, onco.tnm.rawN, onco.tnm.rawM].map((d, i) => (
                                      <span
                                        key={i}
                                        className="px-2 py-0.5 rounded border font-mono font-bold text-[10.5px] bg-slate-100 text-slate-800 border-slate-300"
                                      >
                                        {i === 0 && onco.tnm?.prefix ? `${onco.tnm.prefix}${d}` : d}
                                      </span>
                                    ))}
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    {onco.ajccStage && (
                                      <span className={`px-2 py-0.5 rounded-full border font-extrabold text-[10.5px] ${
                                        onco.ajccStage.stage.startsWith('IV')
                                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                                          : onco.ajccStage.stage.startsWith('III')
                                            ? 'bg-orange-100 text-orange-900 border-orange-300'
                                            : onco.ajccStage.stage.startsWith('II')
                                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                                              : 'bg-sky-100 text-sky-900 border-sky-300'
                                      }`}>
                                        {onco.ajccStage.stageRoman}
                                      </span>
                                    )}
                                    {onco.ajccStage?.confidence === 'estimated' && (
                                      <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold bg-amber-50 text-amber-800 border-amber-300">
                                        Estimasi
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Diagnosis one-liner box */}
                                <div className="p-2.5 rounded-lg bg-maroon-50/70 border border-maroon-200/70">
                                  <div className="text-[9.5px] font-extrabold text-maroon-800 uppercase tracking-wide mb-1">
                                    Diagnosis Utama (Format Sp.PD):
                                  </div>
                                  <div className="text-[11.5px] font-bold text-maroon-950 leading-snug select-all">
                                    {onco.diagnosisOneLiner}
                                  </div>
                                </div>

                                {/* Therapy suffix tags */}
                                {(onco.surgicalInterventions.length > 0 || onco.systemicTherapies.length > 0) && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {onco.surgicalInterventions.map((s, i) => (
                                      <span
                                        key={`s-${i}`}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-medium bg-blue-50 text-blue-900 border-blue-300"
                                      >
                                        <Syringe className="w-2.5 h-2.5" />
                                        {s.type}{s.date ? ` (${s.date})` : ''}
                                      </span>
                                    ))}
                                    {onco.systemicTherapies.map((t, i) => (
                                      <span
                                        key={`t-${i}`}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-medium bg-purple-50 text-purple-900 border-purple-300"
                                      >
                                        <Pill className="w-2.5 h-2.5" />
                                        {t.setting !== 'unknown' ? `${t.setting.toUpperCase()} ` : ''}{t.regimen}
                                        {t.cycle ? ` ${t.cycle}` : ''}
                                        {t.date ? ` (${t.date})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* HOM / Pertimbangan Terapi Sistemik accordion */}
                                {onco.therapyConsiderations.length > 0 && (() => {
                                  // Local state not available in map; use a simple expandable via details/summary
                                  return (
                                    <details className="group rounded-lg border border-amber-200/80 overflow-hidden">
                                      <summary className="flex items-center justify-between px-2.5 py-2 bg-amber-50/80 hover:bg-amber-100/80 cursor-pointer list-none">
                                        <div className="flex items-center gap-1.5">
                                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                          <span className="text-[10px] font-bold text-amber-950">
                                            Pertimbangan Terapi Sistemik / HOM
                                          </span>
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 font-bold">
                                            {onco.therapyConsiderations.length} advis
                                          </span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-amber-500 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      <div className="p-2.5 bg-white border-t border-amber-100">
                                        <ul className="space-y-1.5">
                                          {onco.therapyConsiderations.map((advis, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[10.5px] text-amber-950">
                                              <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[7.5px] font-extrabold shrink-0">
                                                {i + 1}
                                              </span>
                                              <span className="leading-snug font-medium">{advis}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </details>
                                  );
                                })()}

                                {/* Action bar */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCopy(onco.diagnosisOneLiner, 'Diagnosis Onkologi')}
                                    className={`h-7 px-2.5 text-[10.5px] font-semibold transition-all ${
                                      copiedKey === 'Diagnosis Onkologi'
                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                        : 'border-purple-300 text-purple-900 hover:bg-purple-50'
                                    }`}
                                    title="Salin 1 baris diagnosis untuk kolom Asesmen/Diagnosis EMR"
                                  >
                                    {copiedKey === 'Diagnosis Onkologi' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                    Salin Diagnosis Saja
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCopy(onco.diagnosisWithNotes, 'Asesmen Onkologi Lengkap')}
                                    className={`h-7 px-2.5 text-[10.5px] font-bold transition-all shadow-xs ${
                                      copiedKey === 'Asesmen Onkologi Lengkap'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-maroon-800 hover:bg-maroon-900 text-white'
                                    }`}
                                    title="Salin diagnosis + catatan klinis + pertimbangan HOM"
                                  >
                                    {copiedKey === 'Asesmen Onkologi Lengkap' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                    Salin Lengkap + HOM
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleInject(onco.diagnosisWithNotes, 'Asesmen Onkologi')}
                                    className="h-7 px-2.5 text-[10.5px] bg-gold-500 hover:bg-gold-400 text-maroon-950 font-extrabold shadow-xs"
                                    title="Injeksi langsung ke kolom rekam medis elektronik aktif"
                                  >
                                    <MousePointerClick className="w-3 h-3 mr-1 text-maroon-800" />
                                    Inject ke EMR
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 4 Pilar Planning (2x2 Grid) */}
                          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                            {/* Pdx */}
                            <div className="p-2.5 bg-cyan-50/40 space-y-1">
                              <div className="text-[10px] font-extrabold text-cyan-900 uppercase tracking-tight flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                                <span>Pdx (Diagnostik):</span>
                              </div>
                              <p className="text-[10.5px] text-slate-700 leading-snug font-medium whitespace-pre-wrap">
                                {problem.planning.dx || '-'}
                              </p>
                            </div>

                            {/* Ptx */}
                            <div className="p-2.5 bg-emerald-50/40 space-y-1">
                              <div className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-tight flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>Ptx (Terapeutik):</span>
                              </div>
                              <p className="text-[10.5px] text-emerald-950 leading-snug font-medium whitespace-pre-wrap">
                                {problem.planning.tx || '-'}
                              </p>
                            </div>

                            {/* Pmx */}
                            <div className="p-2.5 bg-amber-50/40 space-y-1">
                              <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-tight flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                <span>Pmx (Monitoring):</span>
                              </div>
                              <p className="text-[10.5px] text-slate-700 leading-snug font-medium whitespace-pre-wrap">
                                {problem.planning.mx || '-'}
                              </p>
                            </div>

                            {/* Pex */}
                            <div className="p-2.5 bg-purple-50/40 space-y-1">
                              <div className="text-[10px] font-extrabold text-purple-900 uppercase tracking-tight flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                <span>Pex (Edukasi):</span>
                              </div>
                              <p className="text-[10.5px] text-slate-700 leading-snug font-medium whitespace-pre-wrap">
                                {problem.planning.ex || '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Quick Modal Preview: Ringkasan Siap Salin ke EMR ── */}
      {showEmrPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setShowEmrPreview(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-maroon-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-gradient-to-r from-maroon-900 to-slate-900 text-white">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-gold-400" />
                <span className="font-bold text-xs text-gold-200">
                  Preview Ringkasan Siap Salin (Format Rekam Medis / EMR)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEmrPreview(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Clean EMR Text */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs font-sans text-slate-800 leading-relaxed whitespace-pre-wrap shadow-inner select-text">
                {emrReadyText}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                Format bersih &bull; Tidak merusak editor EMR
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEmrPreview(false)}
                  className="h-7 text-xs"
                >
                  Tutup
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleCopy(emrReadyText, 'Ringkasan EMR');
                    setShowEmrPreview(false);
                  }}
                  className="h-7 text-xs bg-maroon-800 hover:bg-maroon-900 text-white font-bold px-3 gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-gold-300" />
                  <span>Salin ke Clipboard</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpPdWorkflowPanel;
