import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { deidentifyText } from '../../services/deid/deidentifier';
import type { DeidEntity } from '../../types/research';

export interface PrivacySensorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const COMPLIANCE_BADGES = [
  { label: 'UU PDP No. 27/2022', desc: 'Perlindungan Data Pribadi Indonesia', status: 'Patuh' },
  { label: 'HIPAA Safe Harbor', desc: '18 Kategori Pengenal Dihapus', status: 'Patuh' },
  { label: 'store: false', desc: 'Zero Cloud Retention di Google Gemini', status: 'Aktif' },
  { label: '100% In-Browser RAM', desc: 'Zero Egress Rekam Medis Mentah', status: 'Terisolasi' },
];

/**
 * Maps raw entity categories to user-friendly Indonesian labels.
 */
export function getIndonesianCategoryLabel(category: string): string {
  switch (category.toUpperCase()) {
    case 'NAME':
    case 'PATIENT':
      return 'Nama Pasien / Sapaan';
    case 'MRN':
      return 'Nomor Rekam Medis (No. RM)';
    case 'SSN':
    case 'NIK':
      return 'NIK (Nomor Induk Kependudukan)';
    case 'HEALTH_PLAN_ID':
    case 'BPJS':
      return 'Nomor BPJS Kesehatan / Asuransi';
    case 'PHONE':
      return 'Nomor Telepon / WhatsApp';
    case 'DATE':
      return 'Tanggal Lahir / Pemeriksaan';
    case 'ADDRESS':
      return 'Alamat / Domisili';
    case 'AGE':
      return 'Usia Pasien (>89 Th)';
    case 'EMAIL':
      return 'Alamat Email';
    case 'URL':
      return 'Tautan Web / URL';
    case 'IP_ADDRESS':
      return 'Alamat IP Perangkat';
    case 'DOCTOR':
      return 'Nama Tenaga Medis / DPJP';
    case 'HOSPITAL':
      return 'Nama Rumah Sakit / Faskes';
    case 'FAX':
      return 'Nomor Faksimili';
    default:
      return category;
  }
}

/**
 * Formats an audit trail summary text for clipboard copying or inspection.
 */
export function formatAuditTrailSummary(entities: DeidEntity[], totalCharsRaw: number): string {
  const lines: string[] = [
    '=== LAPORAN AUDIT PRIVASI SENSOR (ZERO-EGRESS PHI SHIELD) ===',
    `Jumlah Entitas Identitas Disensor: ${entities.length}`,
    `Panjang Teks Mentah: ${totalCharsRaw} karakter`,
    'Standar: UU PDP No. 27/2022 & HIPAA Safe Harbor 45 CFR § 164.514',
    'Transmisi Cloud: Hanya Token Pengganti (store: false)',
    '',
    'DAFTAR ENTITAS YANG DISENSOR:',
  ];

  if (entities.length === 0) {
    lines.push('- Tidak ditemukan entitas PHI terdeteksi pada teks.');
  } else {
    entities.forEach((e, idx) => {
      lines.push(
        `${idx + 1}. [${e.category}] "${e.text}" -> ${e.replacement} (Karakter ${e.start}-${e.end})`,
      );
    });
  }

  return lines.join('\n');
}

export const PrivacySensorPreviewModal: React.FC<PrivacySensorPreviewModalProps> = ({
  isOpen,
  onClose,
  rawText,
  onShowToast,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const deidResult = useMemo(() => {
    if (!rawText || !rawText.trim()) {
      return { redactedText: '', entities: [] };
    }
    return deidentifyText(rawText);
  }, [rawText]);

  const filteredEntities = useMemo(() => {
    if (!filterQuery.trim()) return deidResult.entities;
    const qLower = filterQuery.toLowerCase();
    return deidResult.entities.filter(
      (e) =>
        e.text.toLowerCase().includes(qLower) ||
        e.replacement.toLowerCase().includes(qLower) ||
        e.category.toLowerCase().includes(qLower) ||
        getIndonesianCategoryLabel(e.category).toLowerCase().includes(qLower),
    );
  }, [deidResult.entities, filterQuery]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
      onShowToast?.(`${label} berhasil disalin ke clipboard!`, 'success');
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="w-[96vw] max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border-emerald-800/40"
    >
      {/* ── Modal Header ── */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-950 to-maroon-950 p-3.5 text-white flex items-center justify-between border-b border-emerald-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-900/90 border border-emerald-400/60 flex items-center justify-center text-emerald-300 shadow-md shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-emerald-100">
                Pratinjau Sensor Privasi (Zero-Egress PHI Shield)
              </h2>
              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                100% In-Browser RAM
              </span>
            </div>
            <p className="text-[10.5px] text-slate-300 font-medium">
              Bukti transparansi de-identifikasi sebelum transmisi payload ke Google Gemini
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Tutup (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Compliance Badges Bar ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-white shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {COMPLIANCE_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/90 border border-emerald-500/30 text-[10px]"
              title={b.desc}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-bold text-slate-200">{b.label}</span>
              <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-950/80 px-1 rounded">
                {b.status}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono">
          <span>Entitas Disensor:</span>
          <strong className="text-emerald-400 font-bold">{deidResult.entities.length} item</strong>
        </div>
      </div>

      {/* ── Modal Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/70 text-xs">
        {/* Zero-Egress Guarantee Box */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-white to-gold-50/40 border border-emerald-300/80 text-emerald-950 space-y-1.5 shadow-2xs">
          <div className="font-extrabold text-xs flex items-center justify-between text-emerald-900">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>Jaminan Kepatuhan &amp; Nol-Egress PHI (Zero Patient Data Egress):</span>
            </span>
            <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
              store: false
            </span>
          </div>
          <p className="text-[11px] text-emerald-900 leading-relaxed font-sans">
            Seluruh nama pasien, Nomor Rekam Medis (No. RM), NIK 16 digit, nomor BPJS Kesehatan,
            nomor kontak/telepon, dan alamat{' '}
            <strong>
              disensor menjadi token kanonikal secara lokal di dalam memori RAM komputer Anda
            </strong>
            . Kunci pemetaan token (<code>tokenMap</code>) disimpan sementara di sesi memori browser
            dan tidak pernah dikirim ke jaringan. Saat respons AI diterima, identitas pasien
            dipulihkan kembali hanya di layar Anda.
          </p>
        </div>

        {/* ── Side-by-Side Diff Section ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Column 1: Raw Original Text in Browser RAM */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-slate-700 font-bold text-[11.5px] px-0.5">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>1. Teks Asli Dokter (Memori Browser RAM):</span>
              </span>
              <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                Data Rahasia / PHI
              </span>
            </div>
            <div className="p-3 bg-white border border-slate-300 rounded-xl h-52 overflow-y-auto font-mono text-[11px] text-slate-800 whitespace-pre-wrap shadow-inner leading-relaxed select-text flex-1">
              {rawText ? (
                rawText
              ) : (
                <span className="text-slate-400 italic">
                  Belum ada teks klinis yang dimasukkan.
                </span>
              )}
            </div>
          </div>

          {/* Column 2: De-identified Scrubbed Text Sent to Gemini */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-emerald-900 font-bold text-[11.5px] px-0.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>2. Teks Tersensor yang Ditransmisikan (Hanya Ini):</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(deidResult.redactedText, 'Teks Tersensor')}
                  disabled={!deidResult.redactedText}
                  className="h-5 px-1.5 text-[9.5px] border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                >
                  <Copy className="w-2.5 h-2.5 mr-0.5" />
                  <span>{copiedKey === 'Teks Tersensor' ? 'Tersalin' : 'Salin'}</span>
                </Button>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">
                  Zero-PHI
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50/50 border border-emerald-300 rounded-xl h-52 overflow-y-auto font-mono text-[11px] text-emerald-950 whitespace-pre-wrap shadow-inner leading-relaxed select-text flex-1">
              {deidResult.redactedText ? (
                deidResult.redactedText
              ) : (
                <span className="text-slate-400 italic">Belum ada teks klinis yang disensor.</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Entity Audit Trail Table ── */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-xs">
                  Tabel Jejak Audit Sensor Entitas Identitas (Audit Trail)
                </h3>
                <Badge
                  variant="primary"
                  size="sm"
                  className="bg-emerald-900 text-emerald-200 font-bold text-[9px]"
                >
                  {deidResult.entities.length} Entitas
                </Badge>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                Pemeriksaan bukti perlindungan setiap kata kunci identitas pasien sebelum transmisi
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Table search filter */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Saring entitas..."
                  className="pl-6 pr-2 py-1 text-[11px] rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 w-36"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  handleCopy(
                    formatAuditTrailSummary(deidResult.entities, rawText.length),
                    'Laporan Audit',
                  )
                }
                disabled={deidResult.entities.length === 0}
                className="h-6 px-2 text-[10.5px] border-slate-300"
              >
                {copiedKey === 'Laporan Audit' ? (
                  <Check className="w-3 h-3 text-emerald-600 mr-1" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-600 mr-1" />
                )}
                <span>Salin Audit</span>
              </Button>
            </div>
          </div>

          {deidResult.entities.length === 0 ? (
            <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
              <p className="font-semibold text-slate-800 text-xs">
                Tidak ada entitas PHI terdeteksi pada teks input saat ini.
              </p>
              <p className="text-[11px] text-slate-400">
                Teks tidak mengandung nama pasien, NIK, No. RM, atau nomor kontak langsung.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[11px] divide-y divide-slate-200 font-sans">
                <thead className="bg-slate-50 text-slate-700 font-bold text-[10.5px]">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                    <th className="py-2 px-3">Kategori Identitas</th>
                    <th className="py-2 px-3">Nilai Asli Pasien (Memori RAM)</th>
                    <th className="py-2 px-3">Token Pengganti (Ke Cloud)</th>
                    <th className="py-2 px-3 text-center">Posisi Karakter</th>
                    <th className="py-2 px-3 text-right">Status Perlindungan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredEntities.map((ent, idx) => (
                    <tr
                      key={`${ent.category}-${ent.start}-${ent.end}-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-1.5 px-2.5 text-center font-mono text-slate-400 text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="font-semibold text-slate-900 block">
                          {getIndonesianCategoryLabel(ent.category)}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400 uppercase">
                          {ent.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-rose-700 bg-rose-50/50">
                        <span className="line-through">{ent.text}</span>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-emerald-800 font-bold bg-emerald-50/40">
                        {ent.replacement}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-slate-500 text-[10px]">
                        {ent.start} &ndash; {ent.end}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-2.5 h-2.5" />
                          <span>Terlindungi</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Footer ── */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
        <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-gold-600" />
          <span>
            Privasi Invariant: Tidak ada data identitas asli yang keluar dari peramban ini.
          </span>
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 px-3 text-xs"
        >
          Tutup Pratinjau
        </Button>
      </div>
    </Modal>
  );
};

export default PrivacySensorPreviewModal;
