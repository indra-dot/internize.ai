import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  Droplets,
  FileCheck,
  Flame,
  HeartPulse,
  MousePointerClick,
  Pill,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  InternalMedicineEngine,
  type SpPdConsultResult,
  type SpPdPomrResult,
  type ClinicalSafetyReport,
  type SurgicalUrgencyType,
  type OperativeToleranceStatus,
} from '../../services/clinical/internalMedicineEngine';
import { insertTextToActiveField } from '../../services/emr/fieldInjector';

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
  // Binary Surgical Urgency state: 'elektif' vs 'life_saving'
  const [surgicalUrgency, setSurgicalUrgency] = useState<SurgicalUrgencyType>('elektif');
  const [expandedProblem, setExpandedProblem] = useState<number | null>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Active column tab: 'pomr' | 'konsul' | 'safety'
  const [activeColumn, setActiveColumn] = useState<'pomr' | 'konsul' | 'safety'>('pomr');

  // Compute live deterministic results using InternalMedicineEngine
  const consultResult: SpPdConsultResult = InternalMedicineEngine.generateConsultationAnswer(
    inputText,
    surgicalUrgency,
  );
  const pomrResult: SpPdPomrResult = InternalMedicineEngine.generatePomrNote(inputText);
  const safetyReport: ClinicalSafetyReport = InternalMedicineEngine.evaluateClinicalSafetyGuard(
    inputText,
    pomrResult.vitals,
    pomrResult.abnormalLabs,
    pomrResult.labTrends,
  );

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
    onShowToast?.(`Berhasil menyalin ${label} ke clipboard`, 'success');
  };

  const handleInject = async (text: string, label: string) => {
    const res = await insertTextToActiveField(text);
    if (res.success) {
      onShowToast?.(`Sukses memasukkan ${label} ke field aktif EMR!`, 'success');
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      onShowToast?.(
        res.error ?? `Gagal inject otomatis. ${label} telah disalin ke clipboard.`,
        'warning',
      );
    }
  };

  // Helper for tolerance banner styling
  const renderToleranceBanner = (status: OperativeToleranceStatus) => {
    if (status === 'TUNDA OPERASI ELEKTIF' || status === 'TUNDA OPERASI') {
      return (
        <div className="p-3 rounded-lg bg-rose-950/90 border border-rose-600 text-rose-100 shadow-sm">
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

    if (status === 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL') {
      return (
        <div className="p-3 rounded-lg bg-gradient-to-r from-amber-950 via-orange-950 to-red-950 border border-orange-500 text-orange-100 shadow-sm">
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

    if (status === 'LAIK OPERASI DENGAN CATATAN') {
      return (
        <div className="p-3 rounded-lg bg-amber-900/40 border border-amber-500/80 text-amber-100 shadow-sm">
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
      <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-100 shadow-sm">
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

  return (
    <div className="space-y-3.5 select-text">
      {/* ── Top Bar: Official Sp.PD Header & Sample Switcher ── */}
      <div className="bg-gradient-to-r from-maroon-900 via-maroon-950 to-slate-900 p-2 rounded-xl border border-gold-600/40 shadow-sm text-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1.5 border-b border-maroon-800/80">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-gold-400" />
            <span className="text-xs font-bold tracking-tight text-gold-200">
              Sp.PD Clinical Workflow (3 Kolom Klinis Terintegrasi)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gold-300/90 font-medium">
            <span>11 Divisi IPD PAPDI</span>
            <span>&bull;</span>
            <span className="bg-gold-500/20 px-1.5 py-0.5 rounded text-gold-300 font-mono">
              Deterministic CROGE &lt;10ms
            </span>
          </div>
        </div>

        {/* Quick Sample Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 text-[11px]">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3 text-gold-500" /> Muat Skenario:
          </span>
          <button
            type="button"
            onClick={() => {
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
              setSurgicalUrgency('life_saving');
              onApplySample?.(SAMPLE_LIFE_SAVING_EMERGENCY);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-amber-900/60 text-slate-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500 transition-colors"
          >
            Operasi CITO / Life-Saving (SDH/Aneurisma)
          </button>
          <button
            type="button"
            onClick={() => {
              onApplySample?.(SAMPLE_COMORBID_WARD);
            }}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-gold-900/60 text-slate-300 hover:text-gold-200 border border-slate-700 hover:border-gold-500 transition-colors"
          >
            Visite Bangsal (Polifarmasi Komorbid)
          </button>
        </div>
      </div>

      {/* ── 3 CLINICAL COLUMNS — TAB SWITCHER ── */}
      {/* Tab selector bar */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveColumn('pomr')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
            activeColumn === 'pomr'
              ? 'bg-white text-maroon-900 shadow-sm border border-maroon-200'
              : 'text-slate-500 hover:text-maroon-800 hover:bg-white/60'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
          <span>POMR</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveColumn('konsul')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
            activeColumn === 'konsul'
              ? 'bg-white text-maroon-900 shadow-sm border border-maroon-200'
              : 'text-slate-500 hover:text-maroon-800 hover:bg-white/60'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Konsul</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveColumn('safety')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
            activeColumn === 'safety'
              ? 'bg-white text-maroon-900 shadow-sm border border-maroon-200'
              : 'text-slate-500 hover:text-maroon-800 hover:bg-white/60'
          }`}
        >
          <Pill className="w-3.5 h-3.5 shrink-0" />
          <span>Safety</span>
        </button>
      </div>

      {/* Active Panel */}
      <div className="space-y-3">
        {/* ══════════════════════════════════════════════════════════════════════
            PANEL 1: POMR CPPT BANGSAL (PERIKSA PASIEN)
            ══════════════════════════════════════════════════════════════════════ */}
        {activeColumn === 'pomr' && <div className="space-y-3">
          <Card className="border border-maroon-200 shadow-xs bg-white">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-maroon-50/80 to-slate-50 border-b border-maroon-100">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-maroon-800" />
                  <div>
                    <CardTitle className="text-xs font-bold text-maroon-950">
                      Kolom 1: POMR CPPT Bangsal
                    </CardTitle>
                    <span className="text-[10px] text-slate-500">
                      Dokumentasi Rekam Medis Berbasis Masalah
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(pomrResult.fullDraftText, 'CPPT EMR')}
                    className="h-6 px-1.5 text-[10px] border-maroon-300 text-maroon-800 hover:bg-maroon-50"
                  >
                    {copiedKey === 'CPPT EMR' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span className="ml-1">Salin EMR</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleInject(pomrResult.fullDraftText, 'CPPT EMR')}
                    className="h-6 px-1.5 text-[10px] bg-maroon-800 hover:bg-maroon-900 text-white"
                  >
                    <MousePointerClick className="w-3 h-3 mr-1 text-gold-400" />
                    Inject
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3">
              {/* Header CPPT Sp.PD Resmi */}
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-maroon-700" />
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-semibold text-slate-700">DPJP: dr. Sp.PD</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Format: POMR 4 Pilar (Pdx, Ptx, Pmx, Pex) Sesuai Standar PAPDI
                </div>
              </div>

              {/* Subjective & Objective Summary */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between border-b pb-1">
                  <span>Subjective (S) & Objective (O)</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {pomrResult.abnormalLabs.length} Lab Abnormal
                  </span>
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
                  <div className="p-1 rounded bg-slate-100 border border-slate-200">
                    <div className="text-slate-500 text-[9px]">TD</div>
                    <div className="font-bold text-slate-800">
                      {pomrResult.vitals.rawMatched.bp || '-'}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-slate-100 border border-slate-200">
                    <div className="text-slate-500 text-[9px]">HR</div>
                    <div className="font-bold text-slate-800">
                      {pomrResult.vitals.rawMatched.hr || '-'}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-slate-100 border border-slate-200">
                    <div className="text-slate-500 text-[9px]">RR</div>
                    <div className="font-bold text-slate-800">
                      {pomrResult.vitals.rawMatched.rr || '-'}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-slate-100 border border-slate-200">
                    <div className="text-slate-500 text-[9px]">Suhu</div>
                    <div className="font-bold text-slate-800">
                      {pomrResult.vitals.rawMatched.temp || '-'}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-slate-100 border border-slate-200">
                    <div className="text-slate-500 text-[9px]">SpO2</div>
                    <div className="font-bold text-slate-800">
                      {pomrResult.vitals.rawMatched.spo2 || '-'}
                    </div>
                  </div>
                </div>

                {/* Subjective excerpt */}
                <div className="p-2 rounded bg-amber-50/50 border border-amber-200/60 text-[10.5px] text-slate-700">
                  <span className="font-semibold text-amber-900">Keluhan / Catatan: </span>
                  {pomrResult.generalSubjective[0] || 'Dalam evaluasi harian penyakit dalam.'}
                </div>
              </div>

              {/* Problem List Berurutan Divisi PAPDI dengan 4 Pilar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-maroon-950 border-b pb-1">
                  <span>Daftar Masalah Berurutan (#1, #2, #3...)</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {pomrResult.problems.length} Masalah Aktif
                  </span>
                </div>

                {pomrResult.problems.map((problem) => {
                  const isExpanded = expandedProblem === problem.order;
                  const criticalityBadge =
                    problem.criticality === 'critical'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : problem.criticality === 'high'
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : problem.criticality === 'medium'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <div
                      key={problem.order}
                      className="rounded-lg border border-slate-200 overflow-hidden text-[11px] bg-slate-50/50"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProblem(isExpanded ? null : problem.order)
                        }
                        className="w-full p-2 text-left flex items-start justify-between gap-1.5 hover:bg-slate-100/70 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-maroon-900">
                              #{problem.order}
                            </span>
                            <span className="font-bold text-slate-800">
                              {problem.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap text-[9.5px]">
                            <span className="px-1.5 py-0.2 rounded font-medium bg-slate-200/80 text-slate-700">
                              {problem.divisionName}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-semibold border ${criticalityBadge}`}
                            >
                              {problem.criticality.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 pt-1 border-t border-slate-200 bg-white space-y-2 text-[10.5px]">
                          {/* Pdx: Rencana Diagnostik */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-cyan-900 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                              Pdx (Rencana Diagnostik):
                            </div>
                            <ul className="list-disc list-inside pl-1 text-slate-600 space-y-0.5">
                              {problem.pdx.map((dx, idx) => (
                                <li key={idx} className="leading-snug">
                                  {dx}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Ptx: Rencana Terapi */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-emerald-900 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Ptx (Rencana Terapi Medikamentosa):
                            </div>
                            <ul className="list-disc list-inside pl-1 text-slate-700 space-y-0.5 font-medium">
                              {problem.ptx.map((tx, idx) => (
                                <li key={idx} className="leading-snug text-emerald-950">
                                  {tx}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Pmx: Rencana Monitoring */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-amber-900 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Pmx (Rencana Monitoring):
                            </div>
                            <ul className="list-disc list-inside pl-1 text-slate-600 space-y-0.5">
                              {problem.pmx.map((mx, idx) => (
                                <li key={idx} className="leading-snug">
                                  {mx}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Pex: Rencana Edukasi */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-purple-900 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                              Pex (Rencana Edukasi Pasien & Keluarga):
                            </div>
                            <ul className="list-disc list-inside pl-1 text-slate-600 space-y-0.5">
                              {problem.pex.map((ex, idx) => (
                                <li key={idx} className="leading-snug">
                                  {ex}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>}

        {/* ══════════════════════════════════════════════════════════════════════
            PANEL 2: LEMBAR JAWABAN KONSUL TS
            ══════════════════════════════════════════════════════════════════════ */}
        {activeColumn === 'konsul' && <div className="space-y-3">
          <Card className="border border-maroon-200 shadow-xs bg-white">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-maroon-50/80 to-gold-50/50 border-b border-maroon-100">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-maroon-800" />
                  <div>
                    <CardTitle className="text-xs font-bold text-maroon-950">
                      Kolom 2: Jawaban Konsul TS
                    </CardTitle>
                    <span className="text-[10px] text-slate-500">
                      Surat Rekomendasi & Toleransi Bedah
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopy(consultResult.fullDraftText, 'Jawaban Konsul')}
                  className="h-6 px-2 text-[10px] bg-maroon-800 hover:bg-maroon-900 text-white"
                >
                  {copiedKey === 'Jawaban Konsul' ? (
                    <Check className="w-3 h-3 text-gold-300 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Salin Konsul
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3">
              {/* Sakelar Biner Segmented Control: Elektif vs Life-Saving */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-700 block">
                  Evaluasi Urgensi Prosedur (Biner):
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

              {/* Banner Toleransi Operasi Biner */}
              {renderToleranceBanner(consultResult.toleranceStatus)}

              {/* Rincian Advis Bedah Terstruktur */}
              <div className="space-y-2 text-[11px]">
                {/* Advis Pre-Op */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-maroon-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-maroon-700"></span>
                    Advis Pre-Operatif:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-[10.5px]">
                    {consultResult.preOpAdvis.slice(0, 4).map((adv, idx) => (
                      <li key={idx} className="leading-snug">
                        {adv}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Advis Intra-Op */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                    Advis Intra-Operatif (Proteksi Organ):
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-[10.5px]">
                    {consultResult.intraOpAdvis.slice(0, 3).map((adv, idx) => (
                      <li key={idx} className="leading-snug">
                        {adv}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Advis Post-Op & Rawat Bersama */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                    Advis Post-Op & Rawat Bersama:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-[10.5px]">
                    {consultResult.postOpAdvis.slice(0, 3).map((adv, idx) => (
                      <li key={idx} className="leading-snug">
                        {adv}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Stratifikasi Risiko Perioperatif */}
              <div className="p-2 rounded-lg bg-gold-50/50 border border-gold-200 text-[10px] space-y-1">
                <div className="font-bold text-gold-900 flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-gold-700" />
                  <span>Stratifikasi Risiko Kardiovaskular & Paru:</span>
                </div>
                <div className="text-slate-700">
                  <span className="font-semibold">RCRI Lee: </span>
                  Skor {consultResult.riskStratification.rcriLeeScore} &bull;{' '}
                  {consultResult.riskStratification.rcriLeeClass}
                </div>
                {consultResult.riskStratification.ariscatScore !== null &&
                  consultResult.riskStratification.ariscatScore !== undefined && (
                    <div className="text-slate-700">
                      <span className="font-semibold">ARISCAT: </span>
                      {consultResult.riskStratification.ariscatScore} poin
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>}

        {/* ══════════════════════════════════════════════════════════════════════
            PANEL 3: DRUG SAFETY & RENAL/HEPATIC GUARD
            ══════════════════════════════════════════════════════════════════════ */}
        {activeColumn === 'safety' && <div className="space-y-3">
          <Card className="border border-maroon-200 shadow-xs bg-white">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-slate-50 to-rose-50/40 border-b border-maroon-100">
              <div className="flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-maroon-800" />
                <div>
                  <CardTitle className="text-xs font-bold text-maroon-950">
                    Kolom 3: Drug Safety Guard
                  </CardTitle>
                  <span className="text-[10px] text-slate-500">
                    Renal/Hepatic Dosing & Hazard Tracker
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3 text-[11px]">
              {/* 1. Renal Dose Adjustment Monitor */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                    <Droplets className="w-3.5 h-3.5 text-blue-600" />
                    Renal Dosing Monitor
                  </span>
                  <span
                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                      safetyReport.renal.isImpaired
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {safetyReport.renal.isImpaired ? 'Impaired' : 'Preserved'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="p-1 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 text-[9px]">eGFR (CKD-EPI)</span>
                    <div className="font-extrabold text-blue-900">
                      {safetyReport.renal.eGfr !== null
                        ? `${safetyReport.renal.eGfr} mL/min`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 text-[9px]">CrCl (C-G)</span>
                    <div className="font-extrabold text-blue-900">
                      {safetyReport.renal.crCl !== null
                        ? `${safetyReport.renal.crCl} mL/min`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="text-[9.5px] text-slate-600 leading-tight">
                  <span className="font-semibold text-slate-700">Status: </span>
                  {safetyReport.renal.stage}
                </div>

                {/* Flagged Renal Drugs */}
                {safetyReport.renal.flaggedDrugs.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-700 block">
                      Obat Perlu Penyesuaian Ginjal:
                    </span>
                    {safetyReport.renal.flaggedDrugs.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded bg-amber-50/80 border border-amber-200 text-[10px] space-y-0.5"
                      >
                        <div className="font-bold text-amber-900 flex justify-between">
                          <span>{d.drug}</span>
                          <span className="text-[9px] uppercase font-semibold text-amber-800">
                            {d.severity}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[9.5px] leading-tight">
                          {d.action}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Hepatic Impairment Alert */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                    <Flame className="w-3.5 h-3.5 text-orange-600" />
                    Hepatic Safety Alert
                  </span>
                  <span
                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                      safetyReport.hepatic.isImpaired
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {safetyReport.hepatic.isImpaired ? '>3x ULN' : 'Normal/Mild'}
                  </span>
                </div>

                {safetyReport.hepatic.warning ? (
                  <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-[10px] text-rose-900 font-medium leading-tight">
                    {safetyReport.hepatic.warning}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    Transaminase hepar dalam rentang aman atau kenaikan minimal.
                  </div>
                )}

                {/* Flagged Hepatic Drugs */}
                {safetyReport.hepatic.flaggedDrugs.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200">
                    {safetyReport.hepatic.flaggedDrugs.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded bg-white border border-slate-200 text-[10px] space-y-0.5"
                      >
                        <div className="font-bold text-slate-800">{d.drug}</div>
                        <p className="text-slate-600 text-[9.5px] leading-tight">
                          {d.action}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Critical Drug Interactions & Electrolyte Hazards */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 block text-[11px]">
                  Critical Interactions & Hazards:
                </span>
                {safetyReport.hazards.length === 0 ? (
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-500 text-center">
                    Tidak terdeteksi interaksi obat-elektrolit berisiko letal.
                  </div>
                ) : (
                  safetyReport.hazards.map((hazard) => (
                    <div
                      key={hazard.id}
                      className={`p-2 rounded-lg border text-[10px] space-y-1 ${
                        hazard.severity === 'critical'
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="font-extrabold flex items-center gap-1">
                        <AlertTriangle
                          className={`w-3 h-3 shrink-0 ${
                            hazard.severity === 'critical'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        />
                        <span>{hazard.title}</span>
                      </div>
                      <p className="text-[9.5px] leading-relaxed text-slate-700">
                        {hazard.description}
                      </p>
                      <div className="pt-1 border-t border-slate-200/60 font-semibold text-[9.5px] text-slate-800">
                        Saran: {hazard.recommendation}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 4. Serial Lab Trend Snapshot */}
              <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                <span className="font-bold text-slate-800 block text-[10.5px]">
                  Serial Lab Trend Snapshot:
                </span>
                {safetyReport.labTrends.length === 0 ? (
                  <div className="text-[9.5px] text-slate-500">
                    Belum ada data laboratorium serial.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {safetyReport.labTrends.slice(0, 4).map((trend, idx) => {
                      const isCritical = trend.flag === 'critical';
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[10px] p-1 bg-white rounded border border-slate-200"
                        >
                          <span className="font-medium text-slate-700 truncate max-w-[110px]">
                            {trend.name}
                          </span>
                          <div className="flex items-center gap-1 font-mono font-bold">
                            <span
                              className={
                                isCritical
                                  ? 'text-rose-600 animate-pulse'
                                  : 'text-slate-800'
                              }
                            >
                              {trend.latestValue} {trend.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>}
      </div>
    </div>
  );
};

export default SpPdWorkflowPanel;
