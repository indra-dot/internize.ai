import { Cpu, ShieldCheck, Trash2 } from 'lucide-react';
import type React from 'react';
import { Badge } from '../ui/Badge';

export interface HeaderProps {
  onDeviceMode?: 'webgpu' | 'wasm' | 'ready';
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
  onClearSessionClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onDeviceMode = 'ready',
  onHelpClick,
  onClearSessionClick,
}) => {
  const logoUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icons/icon48.png')
      : '/icons/icon48.png';

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-maroon-100/90 px-3.5 py-2 shadow-[0_1px_3px_rgba(74,21,27,0.04)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-gold-500/40 shadow-sm shrink-0 bg-maroon-900 flex items-center justify-center">
            <img
              src={logoUrl}
              alt="internize.ai Sp.PD Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                internize<span className="text-maroon-900 font-black">.ai</span>
              </h1>
              <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded bg-maroon-900 text-gold-300 border border-gold-600/40 shadow-2xs">
                Internize 2.1
              </span>
            </div>
            <p className="text-[9.5px] text-slate-500 font-medium tracking-wide mt-0.5">
              121 PPK Sp.PD &bull; Konsul &bull; POMR 4P
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Action: Wipe Patient Session */}
          {onClearSessionClick && (
            <button
              type="button"
              onClick={onClearSessionClick}
              title="Bersihkan Sesi Pasien (Hapus draft & memori peramban)"
              className="p-1 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors flex items-center gap-1 text-[10px]"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
              <span className="hidden sm:inline font-semibold">Bersihkan Sesi</span>
            </button>
          )}

          {/* Quick Action: Feature Tour Help Button */}
          {onHelpClick && (
            <button
              type="button"
              onClick={onHelpClick}
              title="Buka Panduan Fitur Internize 2.1"
              className="p-1 rounded-md text-gold-700 hover:text-maroon-900 hover:bg-gold-50 border border-gold-300/60 transition-colors flex items-center justify-center font-bold text-xs w-6 h-6 shrink-0"
            >
              ?
            </button>
          )}

          <Badge variant="success" size="sm" className="hidden xs:inline-flex gap-1 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>On-Device</span>
          </Badge>
          <Badge variant="primary" size="sm" className="gap-1 py-0.5 bg-maroon-50 text-maroon-900 border-maroon-200 text-[10px]">
            <Cpu className="w-3 h-3 text-maroon-700" />
            <span className="uppercase font-semibold">{onDeviceMode}</span>
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default Header;
