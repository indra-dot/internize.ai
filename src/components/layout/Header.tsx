import { Cpu, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { Badge } from '../ui/Badge';

export interface HeaderProps {
  onDeviceMode?: 'webgpu' | 'wasm' | 'ready';
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onDeviceMode = 'ready' }) => {
  const logoUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icons/icon48.png')
      : '/icons/icon48.png';

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-maroon-100/90 px-4 py-2.5 shadow-[0_1px_3px_rgba(74,21,27,0.04)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gold-500/40 shadow-sm shrink-0 bg-maroon-900 flex items-center justify-center">
            <img
              src={logoUrl}
              alt="internize.ai Sp.PD Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to /logo.png
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                internize<span className="text-maroon-900 font-black">.ai</span>
              </h1>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-maroon-900 text-gold-300 border border-gold-600/40 shadow-2xs">
                Sp.PD
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
              Penyakit Dalam &bull; Konsul &bull; POMR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="success" size="sm" className="hidden xs:inline-flex gap-1 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>On-Device</span>
          </Badge>
          <Badge variant="primary" size="sm" className="gap-1 py-0.5 bg-maroon-50 text-maroon-900 border-maroon-200">
            <Cpu className="w-3 h-3 text-maroon-700" />
            <span className="uppercase font-semibold">{onDeviceMode}</span>
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default Header;
