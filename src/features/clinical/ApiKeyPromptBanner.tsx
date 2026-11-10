import type React from 'react';
import { ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export interface ApiKeyPromptBannerProps {
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onOpenByokModal?: () => void;
  onQuickPasteKey?: (key: string) => void;
}

export const ApiKeyPromptBanner: React.FC<ApiKeyPromptBannerProps> = ({
  hasApiKey,
  onOpenSettings,
  onOpenByokModal,
  onQuickPasteKey,
}) => {
  if (hasApiKey) return null;

  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim();
      const aizaMatch = cleaned.match(/AIzaSy[A-Za-z0-9_-]{33}/);
      const aqMatch = cleaned.match(/AQ\.[A-Za-z0-9._-]{20,}/);
      const key = aizaMatch ? aizaMatch[0] : aqMatch ? aqMatch[0] : cleaned.replace(/\s+/g, '');
      if (key && onQuickPasteKey) {
        onQuickPasteKey(key);
      } else if (onOpenByokModal) {
        onOpenByokModal();
      } else {
        onOpenSettings();
      }
    } catch {
      if (onOpenByokModal) {
        onOpenByokModal();
      } else {
        onOpenSettings();
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A151B] via-[#5c1c24] to-[#3a1015] border border-amber-500/40 p-4 text-white shadow-xl mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0 text-amber-300 mt-0.5 sm:mt-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-200">Aktifkan AI Klinis Utama (Google Gemini BYOK)</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono">
                100% Gratis & On-Device
              </span>
            </div>
            <p className="text-xs text-amber-100/80 mt-1 max-w-xl">
              Hubungkan API Key Google milik Anda untuk sintesis klinis cerdas berbasis 121 PPK PAPDI & 105+ kalkulator InternaHub.
              Jika belum terpasang, sistem berjalan menggunakan <strong>Mode Offline Otomatis (CROGE Engine)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow hover:scale-[1.02]"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-900" />
            <span>Buat Kunci Gratis</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          <Button
            size="sm"
            variant="outline"
            onClick={handleClipboardPaste}
            className="border-amber-400/40 text-amber-200 hover:bg-amber-500/20 hover:text-white text-xs h-8"
          >
            <span>Tempel Kunci</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
