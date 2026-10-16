import {
  CheckCircle,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { deidentifyText } from '../../services/deid/deidentifier';

export interface PrivacySensorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
}

export const PrivacySensorPreviewModal: React.FC<PrivacySensorPreviewModalProps> = ({
  isOpen,
  onClose,
  rawText,
}) => {
  const deidResult = useMemo(() => {
    if (!rawText.trim()) {
      return { redactedText: '', entities: [] };
    }
    return deidentifyText(rawText);
  }, [rawText]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-maroon-950 p-3.5 text-white flex items-center justify-between border-b border-emerald-500/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-sm shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold tracking-tight text-emerald-100">
                Pratinjau Sensor Privasi (Zero-Egress)
              </h2>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                100% On-Device
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium">
              Bukti transparansi de-identifikasi sebelum transmisi ke Google Gemini
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Comparison Cards */}
      <div className="p-4 space-y-3.5 overflow-y-auto bg-slate-50 flex-1 text-xs">
        {/* Security Invariant Callout */}
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
          <div className="font-bold text-[11px] flex items-center gap-1.5 text-emerald-900">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
            <span>Jaminan Keamanan Rekam Medis Indonesia:</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Teks pasien disensor secara lokal di dalam browser Anda sebelum satu bita pun dikirim ke endpoint Google Gemini Interactions API dengan parameter <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-emerald-900 font-bold">store: false</code> (tanpa penyimpanan di cloud Google).
          </p>
        </div>

        {/* Detected Entities Badge Summary */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-[11.5px]">
              Entitas Terdeteksi & Disensor:
            </span>
            <Badge variant="primary" size="sm" className="bg-maroon-900 text-gold-300 font-extrabold">
              {deidResult.entities.length} Identitas Dihapus
            </Badge>
          </div>

          {deidResult.entities.length === 0 ? (
            <p className="text-slate-500 text-[11px] italic">
              Tidak ditemukan nama, NIK, No. RM, atau nomor kontak pada teks saat ini.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {deidResult.entities.map((e, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-[10.5px] font-mono bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"
                >
                  <span className="text-rose-600 line-through truncate max-w-[120px]">{e.text}</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="text-emerald-700 font-bold">{e.replacement}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Side-by-Side or Stacked Diff */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Box 1: Raw Original Text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-600 font-bold text-[11px]">
              <span>Teks Asli di Browser (Memori Lokal):</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl h-44 overflow-y-auto font-mono text-[11px] text-slate-700 whitespace-pre-wrap shadow-inner leading-relaxed">
              {rawText || <span className="text-slate-400 italic">Belum ada input teks.</span>}
            </div>
          </div>

          {/* Box 2: Scrubbed Text Sent to Gemini */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-emerald-800 font-bold text-[11px]">
              <span>Teks Tersensor (Hanya Ini yang Dikirim):</span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Zero-PHI
              </span>
            </div>
            <div className="p-3 bg-emerald-50/40 border border-emerald-300 rounded-xl h-44 overflow-y-auto font-mono text-[11px] text-emerald-950 whitespace-pre-wrap shadow-inner leading-relaxed">
              {deidResult.redactedText || <span className="text-slate-400 italic">Belum ada input teks.</span>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
