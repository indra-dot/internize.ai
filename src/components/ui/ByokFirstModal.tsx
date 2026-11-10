import type React from 'react';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_AVAILABLE_MODELS,
  loadGeminiConfig,
  saveGeminiConfig,
  testGeminiConnection,
} from '../../services/gemini/client';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ByokFirstModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ByokFirstModal: React.FC<ByokFirstModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadGeminiConfig().then((config) => {
        if (config?.apiKey) {
          setApiKey(config.apiKey);
          if (config.model) setModel(config.model);
        }
      });
      setVerifyStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim();
      if (!cleaned) {
        onShowToast?.('Clipboard kosong.', 'warning');
        return;
      }
      const aizaMatch = cleaned.match(/AIzaSy[A-Za-z0-9_-]{33}/);
      const aqMatch = cleaned.match(/AQ\.[A-Za-z0-9._-]{20,}/);
      const token = aizaMatch ? aizaMatch[0] : aqMatch ? aqMatch[0] : cleaned.replace(/\s+/g, '');
      setApiKey(token);
      setVerifyStatus('idle');
      setErrorMessage('');
      onShowToast?.('Kunci berhasil ditempel dari clipboard.', 'info');
    } catch {
      onShowToast?.('Gagal membaca clipboard. Silakan tempel secara manual.', 'warning');
    }
  };

  const handleSaveAndActivate = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setErrorMessage('Masukkan Google Gemini API Key Anda terlebih dahulu.');
      setVerifyStatus('error');
      return;
    }

    setIsVerifying(true);
    setVerifyStatus('idle');
    setErrorMessage('');

    try {
      const testRes = await testGeminiConnection(trimmed, model);
      if (testRes.success) {
        await saveGeminiConfig({ apiKey: trimmed, model });
        setVerifyStatus('success');
        try {
          localStorage.setItem('hasCompletedByokSetup', 'true');
        } catch {}
        onShowToast?.('Google Gemini API Key berhasil disimpan & diverifikasi!', 'success');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } else {
        setVerifyStatus('error');
        const err = testRes.error || 'Kunci ditolak atau koneksi gagal';
        setErrorMessage(err);
        onShowToast?.(`Verifikasi gagal: ${err}`, 'error');
      }
    } catch (e: any) {
      setVerifyStatus('error');
      setErrorMessage(e?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSkipOffline = () => {
    try {
      localStorage.setItem('hasCompletedByokSetup', 'true');
    } catch {}
    onShowToast?.('Menggunakan Mode Offline Lokal (CROGE Engine). Anda dapat memasang API Key kapan saja dari tab Pengaturan.', 'info');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="p-0 overflow-hidden border border-gold-500/40 rounded-2xl shadow-2xl bg-white"
    >
      {/* Premium Deep Maroon Header */}
      <div className="bg-gradient-to-r from-[#4A151B] via-[#5A1C24] to-[#3B1015] p-5 text-white border-b border-gold-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-gold-300 shadow-sm">
              <KeyRound className="w-5 h-5 text-gold-300" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Setup AI Klinis (BYOK First)</span>
                <Sparkles className="w-4 h-4 text-gold-300 animate-pulse" />
              </h2>
              <p className="text-[11px] text-gold-200/90 font-medium">
                Bring Your Own Key &bull; Privasi 100% On-Device
              </p>
            </div>
          </div>
          <Badge
            variant="warning"
            size="sm"
            className="bg-gold-500/20 text-gold-200 border-gold-400/40 text-[10px] font-mono px-2 py-0.5"
          >
            Langkah Awal
          </Badge>
        </div>

        <p className="text-xs text-amber-100/90 leading-relaxed mt-1">
          Internize.ai menerapkan pendekatan <strong>BYOK First</strong>. Anda menghubungkan API Key
          Google Gemini milik sendiri agar sintesis klinis Sp.PD berjalan maksimal dengan kendali
          privasi penuh di tangan Anda.
        </p>
      </div>

      {/* Body Content */}
      <div className="p-5 space-y-4 text-xs text-slate-700 bg-slate-50/50">
        {/* Privacy & Zero Egress Guarantee Card */}
        <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Jaminan Zero PHI Egress &amp; Zero Retention</span>
          </div>
          <p className="text-[11px] text-emerald-800/90 leading-relaxed">
            Data pasien (Nama, NIK, No. RM, dsb.) disensor otomatis secara lokal di peramban Anda sebelum
            dikirim dengan parameter <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono font-bold text-emerald-950">store: false</code>. Kunci API hanya tersimpan di perangkat lokal Anda (<code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[10px]">chrome.storage.local</code>).
          </p>
        </div>

        {/* 1-Click Get Free Key Action */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-900 block text-xs">Belum punya Google Gemini API Key?</span>
              <span className="text-[11px] text-slate-600">Dapatkan langsung secara gratis tanpa kartu kredit via Google AI Studio.</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Ambil Kunci Gratis</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </div>

        {/* Input & Paste API Key */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="byok-api-key-input" className="font-bold text-slate-800 text-xs flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-maroon-800" />
              <span>Google Gemini API Key</span>
            </label>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="text-[11px] font-bold text-maroon-800 hover:text-maroon-950 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <ClipboardPaste className="w-3 h-3" />
              <span>Tempel Clipboard</span>
            </button>
          </div>

          <div className="relative">
            <input
              id="byok-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setVerifyStatus('idle');
                setErrorMessage('');
              }}
              placeholder="Contoh: AIzaSyD..."
              className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-maroon-800/20 focus:border-maroon-800 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title={showKey ? 'Sembunyikan' : 'Tampilkan'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-1">
          <label htmlFor="byok-model-select" className="font-bold text-slate-800 text-xs flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-maroon-800" />
            <span>Pilihan Model AI</span>
          </label>
          <select
            id="byok-model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-800/20 focus:border-maroon-800 bg-white font-medium text-slate-800"
          >
            {GEMINI_AVAILABLE_MODELS.filter((m) => m.id !== 'custom').map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500">
            Model default <strong>Gemini 3.6 Flash</strong> mendukung paket gratis (Free Tier) Google AI Studio dengan penalaran klinis cepat dan stabil.
          </p>
        </div>

        {/* Status Feedback */}
        {verifyStatus === 'success' && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-2 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Koneksi Google Gemini API Terverifikasi &amp; Siap Digunakan!</span>
          </div>
        )}

        {verifyStatus === 'error' && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Gagal memverifikasi API Key:</span>
              <span className="text-[11px] leading-snug">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Buttons / Actions */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            onClick={handleSaveAndActivate}
            disabled={isVerifying}
            className="w-full py-2.5 font-bold text-xs bg-maroon-900 hover:bg-maroon-950 text-gold-300 border border-gold-500/40 shadow-sm flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gold-300" />
                <span>Memverifikasi Koneksi API...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-gold-300" />
                <span>Simpan &amp; Aktifkan AI Sekarang</span>
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={handleSkipOffline}
            className="text-[11.5px] text-slate-500 hover:text-slate-800 text-center py-1 hover:underline cursor-pointer font-medium"
          >
            Lewati Sementara (Gunakan Mode Offline CROGE 121 PPK)
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ByokFirstModal;