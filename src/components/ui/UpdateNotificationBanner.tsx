import { ArrowDownToLine, BookOpen, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { type VersionInfo, resolveDownloadUrl } from '../../services/updateChecker';

export interface UpdateNotificationBannerProps {
  versionInfo: VersionInfo;
  currentVersion?: string;
  onOpenGuide: () => void;
  onDismiss: () => void;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  versionInfo,
  currentVersion = '2.2.0',
  onOpenGuide,
  onDismiss,
}) => {
  const downloadUrl = resolveDownloadUrl(versionInfo.downloadUrl || '/internize-ai-extension.zip');

  return (
    <div
      data-testid="update-notification-banner"
      className="bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-950 text-white border-b border-gold-500/40 px-3.5 py-2 shadow-sm transition-all animate-in slide-in-from-top duration-200"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-gold-500/20 text-gold-300 border border-gold-500/30 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white">Pembaruan Ekstensi Tersedia!</span>
              <span
                data-testid="update-banner-version-badge"
                className="px-1.5 py-0.2 rounded bg-gold-400 text-maroon-950 font-black text-[10px]"
              >
                {`v${versionInfo.version}`}
              </span>
              {currentVersion && (
                <span className="text-[10px] text-maroon-200">
                  {`(Versi saat ini: v${currentVersion})`}
                </span>
              )}
            </div>
            {versionInfo.changelog && versionInfo.changelog.length > 0 && (
              <p className="text-[11px] text-gold-100/90 mt-0.5 line-clamp-1">
                {versionInfo.changelog[0]}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <a
            href={downloadUrl}
            download="internize-ai-extension.zip"
            data-testid="banner-download-btn"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-maroon-950 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 border border-gold-600/40 shadow-2xs transition-all active:scale-[0.98]"
          >
            <ArrowDownToLine className="w-3 h-3 text-maroon-950" />
            <span>Unduh ZIP</span>
          </a>

          <button
            type="button"
            data-testid="banner-guide-btn"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-gold-200 hover:text-white bg-maroon-800/80 hover:bg-maroon-800 border border-gold-500/30 transition-colors"
          >
            <BookOpen className="w-3 h-3 text-gold-400" />
            <span>Panduan Pasang</span>
          </button>

          <button
            type="button"
            data-testid="banner-dismiss-btn"
            onClick={onDismiss}
            aria-label="Tutup notifikasi pembaruan"
            className="p-1 rounded-md text-maroon-300 hover:text-white hover:bg-maroon-800 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotificationBanner;
