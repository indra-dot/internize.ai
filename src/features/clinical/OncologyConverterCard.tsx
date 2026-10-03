/**
 * OncologyConverterCard.tsx
 * =========================
 * Dedicated Onkologi Bedah → Sp.PD Converter Card for internize.ai.
 *
 * Converts surgical/specialist oncology text (Bedah, THT, Obsgyn, dsb.) into
 * standardized Internal Medicine (Sp.PD) assessment format using the
 * oncologyStagingEngine (100% on-device, zero-egress).
 *
 * Features:
 * - Auto-detection of TNM descriptors and AJCC 8th edition stage grouping
 * - ECOG Performance Status estimation from clinical narrative
 * - Surgical intervention and systemic therapy suffix formatting
 * - 3-button action bar: "Salin Diagnosis Saja", "Salin Lengkap + Catatan", "Inject ke EMR"
 * - Quick sample preset buttons for common oncology consult scenarios
 * - Comorbidity detection with automatic POMR integration markers
 */

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  FlaskConical,
  MousePointerClick,
  Pill,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { insertTextToActiveField } from '../../services/emr/fieldInjector';
import {
  type OncologyConversionResult,
  convertOncologyDiagnosis,
} from '../../services/clinical/oncologyStagingEngine';

// ─── Sample Presets ───────────────────────────────────────────────────────────

export const SAMPLE_ONKOLOGI_KOLOREKTAL = `Adenocarcinoma rectum cT4bN3bM0, infiltrasi uterus, susp fistula retrouterine, post colostomy (11/8/26), post kemo NAC folfiri seri 2 (10/9/26), pasien saat ini lemas di bed tapi masih bisa duduk sendiri dan makan. RPD: DM tipe 2, Hipertensi grade 2.`;

export const SAMPLE_ONKOLOGI_PAYUDARA = `Invasive Ductal Carcinoma mammae sinistra cT3N2M0, post MRM (15/7/26), post kemo adjuvant AC-T siklus 4 (20/9/26). Pasien berjalan mandiri, masih bisa beraktivitas ringan. HER2 positif. ER/PR negatif.`;

export const SAMPLE_ONKOLOGI_NPC = `Karsinoma nasofaring (NPC) T3N2M0 stadium III, post kemoradioterapi konkomitan cisplatin seri 3 (25/8/26). Pasien rawat jalan, mobilitas baik. Susp residual massa parafaring. EBV DNA positif.`;

export const SAMPLE_ONKOLOGI_PARU = `Adenocarcinoma paru kanan cT2bN1M0, EGFR mutasi ekson 21 L858R positif. Pasien saat ini masih aktif bekerja ringan. Rencana mulai Osimertinib lini 1. Trombosit 98.000/uL (Trombositopenia ringan).`;

// ─── Stage Badge Colors ───────────────────────────────────────────────────────

function getStageBadgeColor(stage: string): string {
  if (!stage) return 'bg-slate-100 text-slate-800 border-slate-300';
  if (stage.startsWith('0')) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (stage.startsWith('I') && !stage.startsWith('II') && !stage.startsWith('IV'))
    return 'bg-sky-100 text-sky-900 border-sky-300';
  if (stage.startsWith('II')) return 'bg-amber-100 text-amber-900 border-amber-300';
  if (stage.startsWith('III')) return 'bg-orange-100 text-orange-900 border-orange-300';
  if (stage.startsWith('IV')) return 'bg-rose-100 text-rose-900 border-rose-300';
  return 'bg-slate-100 text-slate-800 border-slate-300';
}

function getEcogBadgeColor(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (score <= 1) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (score === 2) return 'bg-amber-100 text-amber-900 border-amber-300';
  if (score === 3) return 'bg-orange-100 text-orange-900 border-orange-300';
  return 'bg-rose-100 text-rose-900 border-rose-300'; // ECOG 4
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface OncologyConverterCardProps {
  inputText: string;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onApplySample?: (sampleText: string) => void;
}

export const OncologyConverterCard: React.FC<OncologyConverterCardProps> = ({
  inputText,
  onShowToast,
  onApplySample,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(true);
  const [showHom, setShowHom] = useState(true);
  const [showComorbid, setShowComorbid] = useState(true);

  // ── Conversion (pure deterministic, <1ms) ──────────────────────────────────
  const result: OncologyConversionResult = useMemo(
    () => convertOncologyDiagnosis(inputText),
    [inputText],
  );

  const hasContent = inputText.trim().length > 10 && result.isOncologyCase;

  // ── Action Handlers ────────────────────────────────────────────────────────
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
    onShowToast?.(`Berhasil menyalin ${label} ke clipboard`, 'success');
  };

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 select-text">
      {/* ── Header Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-950 via-maroon-950 to-slate-900 p-2.5 rounded-xl border border-purple-700/40 shadow-sm text-white">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-purple-800/60">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-300" />
            <div>
              <span className="text-xs font-bold tracking-tight text-purple-200">
                Konverter Diagnosis Onkologi Bedah → Sp.PD
              </span>
              <div className="text-[10px] text-slate-400 font-normal">
                AJCC 8th Ed. · ECOG PS · Terapi Suffix · Pertimbangan HOM
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-800/80 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>100% On-Device</span>
          </div>
        </div>

        {/* Sample Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 text-[11px]">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-purple-400" /> Preset:
          </span>
          <button
            type="button"
            onClick={() => onApplySample?.(SAMPLE_ONKOLOGI_KOLOREKTAL)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-purple-900/60 text-slate-300 hover:text-purple-200 border border-slate-700 hover:border-purple-500 transition-colors text-[10px]"
          >
            Ca. Rektum T4bN3b
          </button>
          <button
            type="button"
            onClick={() => onApplySample?.(SAMPLE_ONKOLOGI_PAYUDARA)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500 transition-colors text-[10px]"
          >
            IDC Mammae T3N2
          </button>
          <button
            type="button"
            onClick={() => onApplySample?.(SAMPLE_ONKOLOGI_NPC)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-amber-900/60 text-slate-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500 transition-colors text-[10px]"
          >
            NPC T3N2 Kemorad
          </button>
          <button
            type="button"
            onClick={() => onApplySample?.(SAMPLE_ONKOLOGI_PARU)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-sky-900/60 text-slate-300 hover:text-sky-200 border border-slate-700 hover:border-sky-500 transition-colors text-[10px]"
          >
            Adeno Paru EGFR+
          </button>
        </div>
      </div>

      {/* ── Not Detected State ──────────────────────────────────────────────── */}
      {!hasContent && (
        <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500 space-y-1">
          <FlaskConical className="w-6 h-6 mx-auto text-slate-300 mb-1" />
          <p className="text-xs font-semibold text-slate-600">Tidak ada teks onkologi terdeteksi</p>
          <p className="text-[10.5px] text-slate-400">
            Masukkan teks operan bedah/spesialis dengan deskriptor TNM, histologi, riwayat kemo/operasi, dan status fungsional pasien.
          </p>
        </div>
      )}

      {/* ── Main Result Card ────────────────────────────────────────────────── */}
      {hasContent && (
        <div className="space-y-3">
          {/* Staging Summary Header */}
          <Card className="border border-purple-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-purple-50/90 via-white to-maroon-50/50 border-b border-purple-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-maroon-800 shrink-0" />
                  <div>
                    <CardTitle className="text-xs font-extrabold text-maroon-950">
                      Asesmen Standar Sp.PD — Hematologi & Onkologi Medik
                    </CardTitle>
                    <p className="text-[10px] text-slate-500">
                      AJCC 8th Ed. · {result.organDisplay} · {result.histology}
                    </p>
                  </div>
                </div>

                {/* Stage + ECOG Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {result.ajccStage && (
                    <span
                      className={`px-2 py-0.5 rounded-full border font-extrabold text-[10px] ${getStageBadgeColor(result.ajccStage.stage)}`}
                    >
                      {result.ajccStage.stageRoman}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${getEcogBadgeColor(result.ecog.score)}`}
                  >
                    {result.ecog.label}
                  </span>
                  {result.ajccStage?.confidence === 'estimated' && (
                    <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold bg-amber-50 text-amber-800 border-amber-300">
                      Estimasi
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3">
              {/* TNM Row */}
              {result.tnm && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">TNM:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[result.tnm.rawT, result.tnm.rawN, result.tnm.rawM].map((d, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded border font-mono font-bold text-[10.5px] bg-slate-100 text-slate-800 border-slate-300"
                      >
                        {i === 0 && result.tnm?.prefix ? `${result.tnm.prefix}${d}` : d}
                      </span>
                    ))}
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    {result.ajccStage && (
                      <span
                        className={`px-2 py-0.5 rounded-full border font-extrabold text-[10.5px] ${getStageBadgeColor(result.ajccStage.stage)}`}
                      >
                        {result.ajccStage.stageRoman}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnosis One-Liner Box */}
              <div className="p-3 rounded-xl bg-maroon-50/60 border border-maroon-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-maroon-900 uppercase tracking-wide">
                  <ClipboardList className="w-3.5 h-3.5 text-maroon-700" />
                  Diagnosis Utama (Format Sp.PD):
                </div>
                <div className="text-[12px] font-bold text-maroon-950 leading-snug select-all">
                  {result.diagnosisOneLiner}
                </div>
              </div>

              {/* Therapy Tags */}
              {(result.surgicalInterventions.length > 0 || result.systemicTherapies.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {result.surgicalInterventions.map((s, i) => (
                    <span
                      key={`s-${i}`}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-blue-50 text-blue-900 border-blue-300"
                    >
                      <Syringe className="w-2.5 h-2.5" />
                      {s.type}{s.date ? ` (${s.date})` : ''}
                    </span>
                  ))}
                  {result.systemicTherapies.map((t, i) => (
                    <span
                      key={`t-${i}`}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-purple-50 text-purple-900 border-purple-300"
                    >
                      <Pill className="w-2.5 h-2.5" />
                      {t.setting !== 'unknown' ? `${t.setting.toUpperCase()} ` : ''}{t.regimen}
                      {t.cycle ? ` ${t.cycle}` : ''}
                      {t.date ? ` (${t.date})` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: 3-button ergonomic set */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {/* Button 1: Salin Diagnosis Saja */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(result.diagnosisOneLiner, 'Diagnosis Onkologi')}
                  className={`h-7 px-2.5 text-[10.5px] font-semibold transition-all ${
                    copiedKey === 'Diagnosis Onkologi'
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'border-purple-300 text-purple-900 hover:bg-purple-50'
                  }`}
                  title="Salin 1 baris diagnosis untuk kolom Asesmen/Diagnosis EMR"
                >
                  {copiedKey === 'Diagnosis Onkologi' ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Salin Diagnosis Saja
                </Button>

                {/* Button 2: Salin Lengkap + Catatan */}
                <Button
                  size="sm"
                  onClick={() => handleCopy(result.diagnosisWithNotes, 'Asesmen Onkologi Lengkap')}
                  className={`h-7 px-2.5 text-[10.5px] font-bold transition-all shadow-xs ${
                    copiedKey === 'Asesmen Onkologi Lengkap'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-maroon-800 hover:bg-maroon-900 text-white'
                  }`}
                  title="Salin diagnosis + catatan klinis + pertimbangan HOM untuk Visite/Laporan DPJP"
                >
                  {copiedKey === 'Asesmen Onkologi Lengkap' ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Salin Lengkap + Catatan
                </Button>

                {/* Button 3: Inject ke EMR */}
                <Button
                  size="sm"
                  onClick={() => handleInject(result.diagnosisWithNotes, 'Asesmen Onkologi')}
                  className="h-7 px-2.5 text-[10.5px] bg-gold-500 hover:bg-gold-400 text-maroon-950 font-extrabold shadow-xs"
                  title="Injeksi langsung ke kolom rekam medis elektronik aktif"
                >
                  <MousePointerClick className="w-3 h-3 mr-1 text-maroon-800" />
                  Inject ke EMR
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Catatan Klinis Singkat ─────────────────────────────────────── */}
          {result.clinicalNotes.length > 0 && (
            <Card className="border border-slate-200 shadow-2xs bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowNotes(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-maroon-800" />
                  <span className="text-[11px] font-bold text-maroon-950">Catatan Klinis Singkat</span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-maroon-100 text-maroon-900 border border-maroon-200 font-bold">
                    {result.clinicalNotes.length} poin
                  </span>
                </div>
                {showNotes ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {showNotes && (
                <CardContent className="p-3">
                  <ul className="space-y-2">
                    {result.clinicalNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-800">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-maroon-700 text-white flex items-center justify-center text-[8.5px] font-extrabold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Pertimbangan Terapi Sistemik / HOM ───────────────────────── */}
          {result.therapyConsiderations.length > 0 && (
            <Card className="border border-amber-200/80 shadow-2xs bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowHom(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50/70 hover:bg-amber-100/70 border-b border-amber-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[11px] font-bold text-amber-950">
                    Pertimbangan Terapi Sistemik / HOM
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 font-bold">
                    {result.therapyConsiderations.length} advis
                  </span>
                </div>
                {showHom ? (
                  <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>

              {showHom && (
                <CardContent className="p-3">
                  <ul className="space-y-2">
                    {result.therapyConsiderations.map((advis, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-amber-950">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8.5px] font-extrabold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="leading-snug font-medium">{advis}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Komorbiditas Penyerta ──────────────────────────────────────── */}
          {result.comorbidities.length > 0 && (
            <Card className="border border-blue-200/80 shadow-2xs bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowComorbid(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 border-b border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-700" />
                  <span className="text-[11px] font-bold text-blue-950">
                    Komorbiditas Penyerta
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-900 border border-blue-300 font-bold">
                    {result.comorbidities.length} masalah
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-blue-600 font-medium">
                    → Masuk Problem List POMR
                  </span>
                  {showComorbid ? (
                    <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </div>
              </button>

              {showComorbid && (
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {result.comorbidities.map((c, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10.5px] font-medium bg-blue-50 text-blue-900 border-blue-200"
                      >
                        <span className="w-3 h-3 rounded-full bg-blue-600 text-white flex items-center justify-center text-[7px] font-extrabold shrink-0">
                          {idx + 1}
                        </span>
                        <span>{c.name}</span>
                        <span className="text-[9px] text-blue-500">({c.category})</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2 font-medium">
                    ℹ️ Komorbiditas di atas akan masuk sebagai problem terpisah di tab POMR/Konsul — bukan digabung ke dalam baris diagnosis onkologi utama.
                  </p>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default OncologyConverterCard;
