import {
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  FileText,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  Trash2,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ClinicalEngineCoordinator } from '../../services/clinical/engine';
import { loadClinicalDraft, saveClinicalDraft } from '../../services/storage/chromeStorage';
import type {
  ClinicalAnalysisResult,
  InferenceDevice,
  RxNormConcept,
  SnomedConcept,
  SoapNote,
} from '../../types/clinical';
import { ImageInputPanel } from './ImageInputPanel';
import { RxNormTable } from './RxNormTable';
import { SnomedTable } from './SnomedTable';
import { SoapNoteViewer } from './SoapNoteViewer';
import {
  SAMPLE_AKUT_CONSUL,
  SAMPLE_PREOP_CONSUL,
  SAMPLE_RABER_CONSUL,
  SpPdWorkflowPanel,
} from './SpPdWorkflowPanel';
import {
  SAMPLE_ONKOLOGI_KOLOREKTAL,
} from './OncologyConverterCard';

export interface ClinicalServiceTabProps {
  initialText?: string;
  onTextChange?: (text: string) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SAMPLE_CLINICAL_NOTE =
  'Pasien pria 58 tahun dengan riwayat Hipertensi Grade 2 dan DM Tipe 2. Terapi rutin Metformin 3x500mg dan Lisinopril 10mg 1x1.';

// ──────────────────────────────────────────────────────────────────────────────
// Main tab component
// ──────────────────────────────────────────────────────────────────────────────

export const ClinicalServiceTab: React.FC<ClinicalServiceTabProps> = ({
  initialText = '',
  onTextChange,
  onShowToast,
}) => {
  const [inputText, setInputText] = useState<string>(initialText);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [inferenceDevice, setInferenceDevice] = useState<InferenceDevice>('webgpu');
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [showOcrPanel, setShowOcrPanel] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [snomedConcepts, setSnomedConcepts] = useState<SnomedConcept[]>([]);
  const [rxnormConcepts, setRxnormConcepts] = useState<RxNormConcept[]>([]);

  // Track previous initialText so we can detect genuine new highlights
  const prevInitialTextRef = useRef<string>('');

  // ── Persist draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initialText) return; // don't overwrite highlight
    loadClinicalDraft().then((draft) => {
      if (draft) {
        setInputText(draft);
      }
    });
  }, [initialText]);

  // ── Detect hardware on mount ───────────────────────────────────────────
  useEffect(() => {
    ClinicalEngineCoordinator.detectInferenceDevice().then(setInferenceDevice);
  }, []);

  // ── React to new highlight from content script ─────────────────────────
  useEffect(() => {
    if (!initialText || initialText === prevInitialTextRef.current) return;
    prevInitialTextRef.current = initialText;
    setInputText(initialText);
    onTextChange?.(initialText);
  }, [initialText, onTextChange]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    onTextChange?.(val);
    saveClinicalDraft(val);
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_CLINICAL_NOTE);
    onTextChange?.(SAMPLE_CLINICAL_NOTE);
    saveClinicalDraft(SAMPLE_CLINICAL_NOTE);
    onShowToast?.('Contoh catatan medis umum (Hipertensi & DM) berhasil dimuat', 'info');
  };

  const handleLoadSpPdSample = () => {
    setInputText(SAMPLE_PREOP_CONSUL);
    onTextChange?.(SAMPLE_PREOP_CONSUL);
    saveClinicalDraft(SAMPLE_PREOP_CONSUL);
    onShowToast?.('Memuat contoh kasus Konsul Pre-Op Bedah (DM + HT + Kolesistitis)', 'info');
  };

  const handleLoadRaberSample = () => {
    setInputText(SAMPLE_RABER_CONSUL);
    onTextChange?.(SAMPLE_RABER_CONSUL);
    saveClinicalDraft(SAMPLE_RABER_CONSUL);
    onShowToast?.('Memuat contoh kasus Rawat Bersama Obsgyn (AKI + PEB)', 'info');
  };

  const handleLoadAkutSample = () => {
    setInputText(SAMPLE_AKUT_CONSUL);
    onTextChange?.(SAMPLE_AKUT_CONSUL);
    saveClinicalDraft(SAMPLE_AKUT_CONSUL);
    onShowToast?.('Memuat contoh kasus Evaluasi Akut CITO (Hiperkalemia + Krisis)', 'info');
  };

  const handleLoadOnkologiSample = () => {
    setInputText(SAMPLE_ONKOLOGI_KOLOREKTAL);
    onTextChange?.(SAMPLE_ONKOLOGI_KOLOREKTAL);
    saveClinicalDraft(SAMPLE_ONKOLOGI_KOLOREKTAL);
    onShowToast?.('Memuat contoh kasus Onkologi Bedah: Ca. Rektum T4bN3b post-NAC FOLFIRI', 'info');
  };

  const handleClear = () => {
    setInputText('');
    setSoapNote(null);
    setSnomedConcepts([]);
    setRxnormConcepts([]);
    setExecutionTimeMs(null);
    onTextChange?.('');
    saveClinicalDraft('');
    prevInitialTextRef.current = '';
    onShowToast?.('Input catatan medis telah dibersihkan', 'info');
  };

  const handleOcrTextExtracted = (text: string, confidence: number) => {
    setInputText(text);
    onTextChange?.(text);
    saveClinicalDraft(text);
    setShowOcrPanel(false);
    onShowToast?.(
      `Teks OCR berhasil diekstrak (${confidence}% akurat). Silakan klik "Analisis Catatan Medis".`,
      confidence >= 70 ? 'info' : 'warning',
    );
  };

  const runAnalysis = useCallback(
    async (text: string) => {
      if (isProcessing || !text.trim()) return;

      setIsProcessing(true);
      try {
        const result: ClinicalAnalysisResult = await ClinicalEngineCoordinator.analyze(text, {});

        setSoapNote(result.soapNote);
        setSnomedConcepts(result.diagnoses);
        setRxnormConcepts(result.medications);
        setExecutionTimeMs(result.executionTimeMs);
        setInferenceDevice(result.inferenceDevice);

        onShowToast?.(
          `Analisis klinis selesai (${result.executionTimeMs}ms). Draf siap ditinjau.`,
          'success',
        );
      } catch (err: unknown) {
        console.error('[internize.ai] Clinical analysis error:', err);
        const errMsg =
          err instanceof Error ? err.message : 'Terjadi kendala saat menganalisis catatan medis.';
        onShowToast?.(errMsg, 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onShowToast],
  );

  const handleProcessClinical = () => {
    if (!inputText.trim()) {
      onShowToast?.('Silakan masukkan atau sorot teks klinis terlebih dahulu', 'warning');
      return;
    }
    runAnalysis(inputText);
  };

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
  const hasInput = inputText.trim().length > 0;
  const hasResults = Boolean(soapNote || snomedConcepts.length > 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 px-4 pb-6 select-text">
      {/* ── 1. Alur Kerja Linear (Clean Step Indicator) ───────────────── */}
      <div className="bg-slate-100/90 border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <div
            className={`flex items-center gap-1.5 transition-colors ${
              !hasInput ? 'text-maroon-900 font-bold' : 'text-emerald-700'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                !hasInput
                  ? 'bg-maroon-900 text-gold-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              1
            </span>
            <span>Input Catatan</span>
          </div>

          <span className="text-slate-300">&rarr;</span>

          <div
            className={`flex items-center gap-1.5 transition-colors ${
              hasInput && !hasResults
                ? 'text-maroon-900 font-bold'
                : hasResults
                  ? 'text-emerald-700'
                  : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                hasInput && !hasResults
                  ? 'bg-maroon-900 text-gold-300'
                  : hasResults
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              2
            </span>
            <span>Analisis Medis</span>
          </div>

          <span className="text-slate-300">&rarr;</span>

          <div
            className={`flex items-center gap-1.5 transition-colors ${
              hasResults ? 'text-maroon-900 font-bold' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                hasResults
                  ? 'bg-maroon-900 text-gold-300 shadow-2xs'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              3
            </span>
            <span>Review &amp; Salin Draf</span>
          </div>
        </div>
      </div>

      {/* ── 2. Langkah 1: Input Catatan Medis Pasien ──────────────────── */}
      <Card className="border border-maroon-200/80 shadow-sm bg-white overflow-hidden">
        <CardHeader className="py-2.5 px-3.5 bg-gradient-to-r from-maroon-50/80 via-white to-gold-50/40 border-b border-maroon-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-maroon-900 text-gold-300 flex items-center justify-center shadow-2xs">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <CardTitle className="text-xs font-bold text-maroon-950">
                Catatan Medis Pasien
              </CardTitle>
              <p className="text-[10px] text-slate-500 font-normal">
                Ketik, tempel, atau sorot teks di EMR rumah sakit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOcrPanel((v) => !v)}
              className={`text-xs h-7 px-2 gap-1 ${
                showOcrPanel
                  ? 'text-maroon-900 bg-maroon-100/60 font-semibold'
                  : 'text-maroon-800 hover:text-maroon-950 hover:bg-maroon-50'
              }`}
              title="Unggah foto berkas atau hasil lab untuk OCR"
            >
              <Camera className="w-3.5 h-3.5 text-gold-600" />
              <span>Foto / OCR</span>
            </Button>

            {hasInput && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-rose-600 h-7 px-1.5"
                title="Hapus isi catatan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-2.5">
          {/* OCR Panel */}
          {showOcrPanel && (
            <ImageInputPanel
              onTextExtracted={handleOcrTextExtracted}
              onShowToast={onShowToast}
              className="mb-1"
            />
          )}

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-[10.5px] text-slate-500 font-medium shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-gold-600" /> Contoh Kasus:
            </span>
            <button
              type="button"
              onClick={handleLoadSpPdSample}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-gold-50 text-slate-700 hover:text-maroon-900 border border-slate-200 hover:border-gold-400 transition-colors text-[10.5px]"
            >
              Pre-Op Bedah (DM+HT)
            </button>
            <button
              type="button"
              onClick={handleLoadRaberSample}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-gold-50 text-slate-700 hover:text-maroon-900 border border-slate-200 hover:border-gold-400 transition-colors text-[10.5px]"
            >
              Rawat Bersama (AKI+PEB)
            </button>
            <button
              type="button"
              onClick={handleLoadAkutSample}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-gold-50 text-slate-700 hover:text-maroon-900 border border-slate-200 hover:border-gold-400 transition-colors text-[10.5px]"
            >
              Evaluasi Akut CITO
            </button>
            <button
              type="button"
              onClick={handleLoadOnkologiSample}
              className="shrink-0 px-2 py-0.5 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-900 hover:text-purple-950 border border-purple-200 hover:border-purple-400 transition-colors text-[10.5px] font-medium"
            >
              🔬 Onkologi Bedah
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-gold-50 text-slate-600 hover:text-slate-900 border border-slate-200 text-[10.5px]"
            >
              Umum
            </button>
          </div>

          {/* Text Area */}
          <textarea
            value={inputText}
            onChange={handleTextChange}
            placeholder="Sorot teks di sistem EMR mana saja (otomatis tersalin ke sini), atau ketik/paste anamnesis, pemeriksaan fisik, atau hasil lab pasien di sini…"
            className="w-full h-36 text-xs p-3 rounded-lg border border-slate-200 focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 resize-none font-sans leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white shadow-inner"
          />

          {/* Info bar under textarea */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>
              {inputText.length} karakter &bull; {wordCount} kata
            </span>
            {hasInput && (
              <span className="text-emerald-700 font-medium text-[10.5px] flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Teks siap dianalisis
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Langkah 2: Tombol Aksi Utama (Visual Hierarchy) ────────── */}
      <div className="pt-1">
        <Button
          type="button"
          variant="primary"
          size="lg"
          isLoading={isProcessing}
          disabled={isProcessing || !hasInput}
          onClick={handleProcessClinical}
          className="w-full h-11 py-2.5 px-4 font-bold text-xs gap-2 bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-900 hover:from-maroon-800 hover:to-maroon-700 text-gold-200 border border-gold-500/50 shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span>
            {isProcessing ? 'Menganalisis Catatan Medis…' : 'Analisis Catatan Medis & Buat Draf'}
          </span>
        </Button>
      </div>

      {/* ── 4. Langkah 3: Hasil & Review Draf Klinis (Sp.PD Scaffolding) ── */}
      {hasInput && (
        <div className="space-y-3 pt-1">
          <SpPdWorkflowPanel
            inputText={inputText}
            onShowToast={onShowToast}
            onApplySample={(sample) => {
              setInputText(sample);
              onTextChange?.(sample);
              saveClinicalDraft(sample);
            }}
          />
        </div>
      )}


      {/* Draf SOAP Terstruktur (Jika tombol Analisis ditekan) */}
      {soapNote && (
        <div className="pt-1">
          <SoapNoteViewer soapNote={soapNote} onShowToast={onShowToast} />
        </div>
      )}

      {/* Tabel Diagnosis & Obat (Reference Codes) */}
      {snomedConcepts.length > 0 && (
        <SnomedTable concepts={snomedConcepts} onShowToast={onShowToast} />
      )}
      {rxnormConcepts.length > 0 && (
        <RxNormTable medications={rxnormConcepts} onShowToast={onShowToast} />
      )}

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!hasInput && !isProcessing && (
        <div className="text-center p-6 border-2 border-dashed border-maroon-200/80 rounded-xl space-y-2.5 bg-gradient-to-b from-maroon-50/30 to-gold-50/20">
          <div className="w-10 h-10 rounded-full bg-maroon-100 text-maroon-900 flex items-center justify-center mx-auto border border-maroon-200 shadow-2xs">
            <Stethoscope className="w-5 h-5 text-maroon-800" />
          </div>
          <p className="text-xs font-bold text-maroon-950">
            Asisten Dokter Spesialis Penyakit Dalam (Sp.PD)
          </p>
          <p className="text-[11px] text-slate-600 max-w-sm mx-auto leading-relaxed">
            Sorot teks pada tab EMR rumah sakit atau klik salah satu contoh kasus di atas untuk
            langsung menghasilkan draf jawaban konsul toleransi operasi, format POMR bangsal, atau
            resume medis seketika.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLoadSpPdSample}
              className="text-xs text-maroon-900 bg-white hover:bg-gold-50 border border-maroon-300 gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3 text-gold-600" />
              <span>Pre-Op Bedah (DM+HT)</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLoadRaberSample}
              className="text-xs text-maroon-900 bg-white hover:bg-gold-50 border border-maroon-300 gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3 text-gold-600" />
              <span>Rawat Bersama Obsgyn</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLoadAkutSample}
              className="text-xs text-maroon-900 bg-white hover:bg-gold-50 border border-maroon-300 gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3 text-gold-600" />
              <span>Evaluasi Akut CITO</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── 5. Opsi Pengaturan Lanjutan (Collapsible Accordion) ───────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <button
          type="button"
          onClick={() => setShowAdvancedSettings((v) => !v)}
          className="w-full flex items-center justify-between p-3 text-left bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">
              Pengaturan Lanjutan (Hardware &amp; Model)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">
              {showAdvancedSettings ? 'Tutup' : 'Buka'}
            </span>
            {showAdvancedSettings ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {showAdvancedSettings && (
          <div className="p-3.5 space-y-3.5 border-t border-slate-200 text-xs bg-white">
            {/* Backend hardware status */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block text-[11px]">Backend Komputasi Klinis</span>
                <p className="text-[10.5px] text-slate-500">
                  {inferenceDevice === 'webgpu'
                    ? 'Akselerasi WebGPU terdeteksi & aktif di peramban.'
                    : 'WASM CPU Fallback aktif untuk perangkat tanpa WebGPU.'}
                </p>
              </div>
              {inferenceDevice === 'webgpu' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-[10.5px]">
                  <Cpu className="w-3 h-3 text-emerald-600" />
                  <span>WebGPU</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 text-[10.5px]">
                  <Cpu className="w-3 h-3 text-amber-600" />
                  <span>WASM</span>
                </span>
              )}
            </div>
            {/* Execution time */}
            {executionTimeMs !== null && (
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Waktu Inferensi Terakhir:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {executionTimeMs} ms
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 6. Informasi Transparansi & Privasi Medis (Footer Callout Box) ── */}
      <div className="rounded-xl border border-maroon-200/80 bg-gradient-to-b from-maroon-50/40 via-white to-gold-50/30 p-3.5 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-maroon-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-maroon-900 text-gold-300 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
            </div>
            <span className="text-xs font-bold text-maroon-950">
              Jaminan Privasi &amp; Keamanan Data Pasien
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              On-Device
            </span>
            <span className="text-[10px] font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded-full border border-maroon-200">
              Cloud Opsional
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 text-[11px] text-slate-700">
          <div className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">
                Komitmen Privasi Medis: On-Device secara Default
              </p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed mt-0.5">
                Pemrosesan klinis inti berjalan lokal di peramban. Mode cloud bersifat opsional
                (BYOK) dan hanya mengirim teks yang sudah di-de-identifikasi ke Google Gemini.
                Data catatan medis tetap di perangkat Anda kecuali mode cloud diaktifkan.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Database className="w-3.5 h-3.5 text-maroon-800 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Model Berjalan dalam Mode Inference-Only</p>
              <p className="text-[10.5px] text-slate-600 leading-relaxed mt-0.5">
                Model AI dan mesin inferensi beroperasi dalam mode inferensi langsung (read-only)
                tanpa menyimpan riwayat teks untuk pelatihan ulang (no model training), menjaga
                etika kerahasiaan medis dan konsistensi diagnosis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Disclaimer Klinis ────────────────────────────────────── */}
      <div className="rounded-lg bg-amber-50/90 border border-amber-200/80 p-2.5 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[10.5px] leading-relaxed text-amber-900">
          <strong className="font-semibold">Clinical Scaffolding &amp; Decision Support Only:</strong>{' '}
          internize.ai Sp.PD menghasilkan draf terstruktur untuk mempermudah telaah klinis Dokter
          Spesialis Penyakit Dalam. Bukan pengganti pertimbangan klinis independen DPJP. Seluruh
          saran toleransi operasi, dosis terapi, dan rencana pemantauan wajib ditinjau dan
          divalidasi oleh dokter penanggung jawab sebelum persetujuan tindakan medis.
        </p>
      </div>
    </div>
  );
};

export default ClinicalServiceTab;
