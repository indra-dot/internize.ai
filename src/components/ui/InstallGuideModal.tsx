import { Check, CheckCircle2, Copy, Download, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { resolveDownloadUrl } from '../../services/updateChecker';
import { Modal } from './Modal';

export interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl?: string;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
  downloadUrl: rawDownloadUrl = '/internize-ai-extension.zip',
}) => {
  const downloadUrl = resolveDownloadUrl(rawDownloadUrl);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'install' | 'update'>('install');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText('chrome://extensions/');
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="max-w-xl border-maroon-200/80 p-0 overflow-hidden"
      hideCloseButton={true}
    >
      <div data-testid="install-guide-modal" className="flex flex-col bg-white">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-950 text-white p-4 relative border-b border-gold-500/30">
          <button
            type="button"
            data-testid="install-guide-close-btn"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1 rounded-lg text-gold-200 hover:text-white hover:bg-maroon-800/80 transition-colors"
            aria-label="Tutup panduan"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gold-500/20 border border-gold-400/40 text-gold-300">
              <ShieldCheck className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Panduan Pemasangan & Pembaruan
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-400/20 text-gold-300 border border-gold-400/40 font-semibold">
                  Chrome / Edge
                </span>
              </div>
              <p className="text-xs text-maroon-100/90 mt-0.5">
                internize.ai Sp.PD — Siap pakai tanpa terminal, git clone, atau login GitHub.
              </p>
            </div>
          </div>

          {/* Tab Switcher: Instalasi Baru vs Update */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-maroon-700/50">
            <button
              type="button"
              data-testid="guide-tab-install"
              onClick={() => setActiveTab('install')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'install'
                  ? 'bg-gold-500 text-maroon-950 shadow-sm'
                  : 'bg-maroon-950/50 text-gold-200 hover:bg-maroon-900 border border-maroon-700/60'
              }`}
            >
              Pemasangan Baru (3 Langkah)
            </button>
            <button
              type="button"
              data-testid="guide-tab-update"
              onClick={() => setActiveTab('update')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'update'
                  ? 'bg-gold-500 text-maroon-950 shadow-sm'
                  : 'bg-maroon-950/50 text-gold-200 hover:bg-maroon-900 border border-maroon-700/60'
              }`}
            >
              Cara Memperbarui (Update)
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'install' ? (
            <div className="space-y-3.5">
              {/* Step 1 */}
              <div
                data-testid="install-step-1"
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-maroon-900 text-gold-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    1
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <h3 className="text-xs font-bold text-slate-900">
                      Unduh & Ekstrak Paket Ekstensi (.ZIP)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Unduh file arsip resmi{' '}
                      <span className="font-semibold text-slate-800">
                        internize-ai-extension.zip
                      </span>
                      , lalu ekstrak ke folder permanen di komputer Anda (contoh:{' '}
                      <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">
                        C:\internize-ai-extension
                      </code>
                      ).
                    </p>
                    <div className="pt-1">
                      <a
                        href={downloadUrl}
                        download="internize-ai-extension.zip"
                        data-testid="download-zip-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-maroon-950 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 border border-gold-600/40 shadow-xs transition-all active:scale-[0.98]"
                      >
                        <Download className="w-3.5 h-3.5 text-maroon-950" />
                        <span>Unduh internize-ai-extension.zip</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div
                data-testid="install-step-2"
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-maroon-900 text-gold-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    2
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <h3 className="text-xs font-bold text-slate-900">
                      Buka Kelola Ekstensi & Aktifkan Developer Mode
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Buka tab baru di browser Anda dan ketik alamat pengelolaan ekstensi, kemudian
                      geser saklar{' '}
                      <span className="font-semibold text-slate-800">
                        "Mode pengembang" (Developer mode)
                      </span>{' '}
                      di pojok kanan atas ke posisi aktif.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <code className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 shadow-2xs">
                        chrome://extensions/
                      </code>
                      <button
                        type="button"
                        data-testid="copy-extension-url-btn"
                        onClick={handleCopyUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-colors"
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Salin URL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10.5px] text-slate-400 italic">
                      *Bagi pengguna Microsoft Edge, gunakan alamat:{' '}
                      <code className="font-mono">edge://extensions/</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div
                data-testid="install-step-3"
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-maroon-900 text-gold-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    3
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-xs font-bold text-slate-900">
                      Klik "Muat yang belum dibongkar" (Load unpacked)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Klik tombol{' '}
                      <span className="font-semibold text-slate-800">
                        "Muat yang belum dibongkar" (Load unpacked)
                      </span>{' '}
                      di kiri atas, lalu arahkan ke folder tempat Anda mengekstrak file ZIP pada
                      Langkah 1.
                    </p>
                    <div className="pt-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Selesai! Ikon internize.ai akan muncul di bilah peramban dan panel samping
                        siap digunakan saat visite.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div data-testid="guide-update-content" className="space-y-3.5">
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <RefreshCw className="w-4 h-4 text-amber-700" />
                  <span>Prosedur Pembaruan Ekstensi Instan (2 Menit)</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Semua pengaturan, API Key Gemini, dan konfigurasi lokal Anda tetap utuh tersimpan
                  di browser saat melakukan pembaruan.
                </p>
              </div>

              <ol className="space-y-3 text-xs text-slate-700 list-decimal list-inside pl-1">
                <li className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900">Unduh paket ZIP versi terbaru:</span>
                  <div className="pt-1">
                    <a
                      href={downloadUrl}
                      download="internize-ai-extension.zip"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold text-maroon-950 bg-gold-400 hover:bg-gold-500 border border-gold-600/40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Versi Terbaru</span>
                    </a>
                  </div>
                </li>
                <li className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900">
                    Ekstrak dan timpa (overwrite) file:
                  </span>
                  <p className="text-slate-600 text-xs">
                    Ekstrak file ZIP baru ke dalam folder instalasi lama Anda dan pilih opsi{' '}
                    <em>Replace / Overwrite</em> seluruh file.
                  </p>
                </li>
                <li className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900">
                    Segarkan di halaman ekstensi browser:
                  </span>
                  <p className="text-slate-600 text-xs">
                    Buka{' '}
                    <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">
                      chrome://extensions/
                    </code>
                    , cari kartu <strong>internize.ai</strong>, dan klik tombol ikon reload (putar
                    ↻). Ekstensi langsung diperbarui!
                  </p>
                </li>
              </ol>
            </div>
          )}

          {/* Privacy & Zero Egress badge */}
          <div className="p-3 rounded-xl bg-maroon-50 border border-maroon-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-maroon-800 shrink-0" />
              <span className="text-maroon-900 font-medium text-[11px]">
                100% On-Device & Zero Egress Invariant — Data pasien tidak pernah keluar dari
                perangkat Anda.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            internize.ai Sp.PD &bull; Standar PAPDI 2026
          </span>
          <button
            type="button"
            data-testid="install-guide-done-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-maroon-900 text-white hover:bg-maroon-950 transition-colors shadow-2xs"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InstallGuideModal;
