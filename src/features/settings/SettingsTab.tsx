import {
  CheckCircle,
  ClipboardPaste,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Sparkles,
  Wifi,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_AVAILABLE_MODELS,
  loadGeminiConfig,
  saveGeminiConfig,
  testGeminiConnection,
} from '../../services/gemini/client';

export interface SettingsTabProps {
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

export const SettingsTab: React.FC<SettingsTabProps> = ({ onShowToast }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [customModel, setCustomModel] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string>('');

  useEffect(() => {
    loadGeminiConfig().then((config) => {
      if (config) {
        setApiKey(config.apiKey || '');
        const isStandard = GEMINI_AVAILABLE_MODELS.some((m) => m.id === config.model);
        if (isStandard) {
          setModel(config.model);
          setCustomModel('');
        } else if (config.model) {
          setModel('custom');
          setCustomModel(config.model);
        }
      }
    });
  }, []);

  const effectiveModel = model === 'custom' ? customModel.trim() || DEFAULT_GEMINI_MODEL : model;

  const handleSave = async () => {
    if (!apiKey.trim()) {
      onShowToast?.('Masukkan Google Gemini API Key terlebih dahulu.', 'warning');
      return;
    }

    await saveGeminiConfig({
      apiKey: apiKey.trim(),
      model: effectiveModel,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    onShowToast?.('Konfigurasi Gemini API tersimpan di chrome.storage.local', 'success');
  };

  const handleTestConnection = async (overrideKey?: string) => {
    const keyToTest = (overrideKey ?? apiKey).trim();
    if (!keyToTest) {
      onShowToast?.('Masukkan API Key sebelum melakukan uji coba koneksi.', 'warning');
      return;
    }

    setConnectionStatus('testing');
    setConnectionError('');

    const result = await testGeminiConnection(keyToTest, effectiveModel);
    if (result.success) {
      setConnectionStatus('ok');
      onShowToast?.('Koneksi Google Gemini API berhasil diverifikasi!', 'success');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.error ?? 'Unknown error');
      onShowToast?.('Kunci tidak valid atau kuota habis.', 'error');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim();
      if (!cleaned) {
        onShowToast?.('Clipboard kosong.', 'warning');
        return;
      }

      // Detect Google API Key format (AIzaSy...)
      const match = cleaned.match(/AIzaSy[A-Za-z0-9_-]{33}/);
      const token = match
        ? match[0]
        : cleaned.startsWith('AIzaSy')
          ? cleaned.replace(/\s+/g, '')
          : cleaned;

      setApiKey(token);
      await saveGeminiConfig({
        apiKey: token,
        model: effectiveModel,
      });

      onShowToast?.('Kunci Google Gemini terdeteksi & tersimpan!', 'success');
      // Otomatis jalankan uji koneksi mandiri
      await handleTestConnection(token);
    } catch {
      onShowToast?.('Gagal membaca clipboard. Izinkan akses clipboard atau tempel manual.', 'error');
    }
  };

  const modelDisplayName =
    GEMINI_AVAILABLE_MODELS.find((m) => m.id === effectiveModel)?.name || effectiveModel;

  return (
    <div className="space-y-4 px-4 pb-6 select-text">
      {/* 1-Klik Ambil Kunci Gratis via AI Studio */}
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:to-amber-500 text-maroon-950 font-extrabold text-xs shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] border border-amber-300"
      >
        <KeyRound className="w-4 h-4 text-maroon-900 shrink-0" />
        <span>👉 [+ Buat Kunci Gemini Gratis via Google (1 Klik)]</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
      </a>

      <Card>
        <CardHeader className="py-2.5">
          <div className="flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-gold-500" />
            <CardTitle>Google Gemini API (BYOK - Bring Your Own Key)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3.5">
          {/* Status Lampu Hijau / Merah / Kuning yang Manusiawi */}
          {connectionStatus === 'testing' && (
            <div className="flex items-center gap-2 text-xs text-sky-800 bg-sky-50 rounded-lg p-2.5 border border-sky-200">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping shrink-0" />
              <span className="font-semibold">Menguji koneksi ke Google Gemini API...</span>
            </div>
          )}

          {connectionStatus !== 'testing' && !apiKey.trim() && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="font-semibold">
                🟡 Kunci Belum Diisi: Menggunakan Mode Offline Otomatis (CROGE Engine)
              </span>
            </div>
          )}

          {connectionStatus === 'error' && apiKey.trim() && (
            <div className="flex items-start justify-between gap-2 text-xs text-rose-800 bg-rose-50 rounded-lg p-2.5 border border-rose-200">
              <div className="flex items-start gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                <div>
                  <p className="font-semibold">
                    🔴 Kunci Tidak Valid / Kuota Habis: Periksa kembali kunci Anda atau klik 'Ambil Kunci Baru'
                  </p>
                  {connectionError && (
                    <p className="text-[10px] text-rose-600 mt-0.5 break-all">{connectionError}</p>
                  )}
                </div>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] underline font-bold text-rose-700 whitespace-nowrap hover:text-rose-900 shrink-0"
              >
                Ambil Kunci Baru
              </a>
            </div>
          )}

          {connectionStatus === 'ok' && apiKey.trim() && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-semibold">
                🟢 Siap Digunakan: Terhubung ke {modelDisplayName} (Online Mode Aktif)
              </span>
            </div>
          )}

          {connectionStatus === 'idle' && apiKey.trim() && (
            <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50/70 rounded-lg p-2.5 border border-emerald-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold">
                  🟢 Siap Digunakan: Terhubung ke {modelDisplayName} (Online Mode Aktif)
                </span>
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-api-key" className="text-xs font-semibold text-slate-700">
                Google Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-[11px] text-maroon-800 hover:text-maroon-900 flex items-center gap-1 font-semibold hover:underline"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-gold-600" />
                <span>Tempel dari Clipboard</span>
              </button>
            </div>
            <div className="relative">
              <input
                id="gemini-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setConnectionStatus('idle');
                }}
                placeholder="AIzaSy..."
                className="w-full text-xs p-2 pr-9 rounded-lg border border-slate-200 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showApiKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Kunci tersimpan aman secara lokal di{' '}
              <span className="font-mono text-slate-500">chrome.storage.local</span> dan tidak
              pernah diunggah ke server perantara manapun.
            </p>
          </div>

          {/* Model Selection Dropdown */}
          <div className="space-y-1">
            <label
              htmlFor="gemini-model-select"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              <span>Model Gemini</span>
            </label>
            <select
              id="gemini-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 bg-white text-slate-800"
            >
              {GEMINI_AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Model Input if 'custom' selected */}
          {model === 'custom' && (
            <div className="space-y-1">
              <label htmlFor="custom-model-input" className="text-xs font-semibold text-slate-700">
                Nama Model Kustom
              </label>
              <input
                id="custom-model-input"
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="misal: gemini-3.8-flash atau models/gemini-3.1-pro-preview"
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 font-mono text-slate-800"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={connectionStatus === 'testing'}
              onClick={() => handleTestConnection()}
              className="flex-1 gap-1.5 text-xs h-9"
            >
              <Wifi className="w-3.5 h-3.5 text-sky-600" />
              <span>Test API Key</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              className="flex-1 gap-1.5 bg-maroon-800 hover:bg-maroon-900 text-gold-200 focus:ring-gold-500 h-9"
            >
              {isSaved ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaved ? 'Tersimpan!' : 'Simpan'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
        <p className="font-bold text-slate-700 flex items-center gap-1.5">
          <span>🔒 Arsitektur Privasi & Kepatuhan PHI</span>
        </p>
        <p className="leading-relaxed">
          <strong className="text-slate-700">Tier 1 & 2 (100% On-Device / Default):</strong> Semua
          ekstraksi entitas, parsing nilai lab, dan penalaran CROGE deterministic berjalan murni di
          peramban pengguna tanpa koneksi internet sama sekali.
        </p>
        <p className="leading-relaxed">
          <strong className="text-slate-700">Tier 3 (Opt-in Cloud Synthesizer - Interactions API):</strong> Teks pasien
          di-deidentifikasi secara lokal terlebih dahulu. Semua nama, MRN, tanggal, dan nomor kontak
          digantikan dengan token tokenisasi aman seperti{' '}
          <span className="font-mono text-slate-700 bg-slate-200 px-1 py-0.5 rounded">
            [PATIENT_1]
          </span>{' '}
          sebelum dikirim ke endpoint Gemini Interactions API dengan parameter{' '}
          <span className="font-mono text-slate-700 bg-slate-200 px-1 py-0.5 rounded">store: false</span>{' '}
          (meminta Google tidak menyimpan riwayat teks di cloud). Pemulihan nama asli (re-identifikasi) dilakukan
          kembali secara lokal di memori browser Anda.
        </p>
      </div>
    </div>
  );
};

export default SettingsTab;
