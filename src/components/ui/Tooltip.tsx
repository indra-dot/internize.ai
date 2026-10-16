import { HelpCircle } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export const CLINICAL_EXPLANATIONS = {
  POMR: 'Format rekam medis berbasis daftar masalah aktif pasien, membagi setiap diagnosis menjadi rencana 4P terstruktur.',
  '4P': '4 Pilar Rencana PAPDI: Pdx (Rencana Penunjang Diagnostik), Ptx (Terapi Obat & Dosis), Pmx (Target Pemantauan Lab & Klinis), Pex (Edukasi Pasien & Keluarga).',
  CROGE:
    'Mesin inferensi klinis deterministik 100% lokal di browser Anda (<15ms). Menghitung dosis dan mengecek kontraindikasi 121 PPK RS tanpa internet dan tanpa kirim data ke cloud.',
  BYOK: 'Gunakan API Key Google Gemini pribadi Anda (gratis via Google AI Studio). Seluruh identitas pasien disensor total secara lokal sebelum dikirim, dan Google tidak pernah menyimpan percakapan (store: false).',
} as const;

export type ClinicalTermKey = keyof typeof CLINICAL_EXPLANATIONS;

export interface InfoTooltipProps {
  content?: string;
  term?: ClinicalTermKey | (string & {});
  label?: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  term,
  label,
  className = '',
  position = 'top',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const resolvedContent =
    content ||
    (term && term in CLINICAL_EXPLANATIONS
      ? CLINICAL_EXPLANATIONS[term as ClinicalTermKey]
      : term || '');

  if (!resolvedContent) {
    return null;
  }

  // Positioning styles
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-maroon-950 border-r-transparent border-b-transparent border-l-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-maroon-950 border-r-transparent border-t-transparent border-l-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-maroon-950 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-maroon-950 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <span
      className={`group relative inline-flex items-center cursor-help ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }}
      tabIndex={0}
      role="button"
      aria-label={typeof label === 'string' ? label : resolvedContent}
      data-testid={term ? `tooltip-term-${term}` : 'info-tooltip'}
    >
      {label && <span className="mr-1">{label}</span>}

      {children ?? (
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 group-hover:text-gold-500 group-focus:text-gold-500 transition-colors shrink-0" />
      )}

      {/* Popover Bubble */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${positionClasses[position]} ${
          isOpen ? 'block' : 'hidden group-hover:block group-focus:block'
        } w-64 max-w-[85vw] p-2.5 rounded-lg bg-maroon-950 text-gold-100 text-[11px] leading-relaxed shadow-xl border border-gold-600/40 z-50 text-left font-normal select-none transition-all duration-150`}
      >
        {resolvedContent}
        <span className={`absolute border-4 ${arrowClasses[position]}`} />
      </span>
    </span>
  );
};

export default InfoTooltip;
