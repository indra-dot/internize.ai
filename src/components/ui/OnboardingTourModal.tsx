import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleCase?: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  category: 'Klinis PPK' | 'Riset & Privasi' | 'Cloud AI';
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleCase,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps: TourStep[] = [
    {
      title: 'Selamat Datang di Internize 2.1',
      subtitle: 'Asisten Klinis Sp.PD & Riset Medis Terintegrasi 121 PPK PAPDI',
      category: 'Klinis PPK',
      icon: <Stethoscope className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>
            <strong className="text-maroon-950 font-bold">internize.ai</strong> kini diperbarui ke versi <strong className="text-maroon-900 font-extrabold">Internize 2.1</strong> dengan otak klinis baru: <strong className="text-slate-900">121 Panduan Praktik Klinis (PPK) & Clinical Pathways</strong> dari 9 divisi PAPDI.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-maroon-50 border border-maroon-200 space-y-1">
              <span className="font-extrabold text-[11px] text-maroon-900 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" /> 100% On-Device
              </span>
              <p className="text-[10.5px] text-maroon-800">
                Semua data pasien diproses di dalam browser Anda tanpa ketergantungan server cloud eksternal.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-gold-50/70 border border-gold-300 space-y-1">
              <span className="font-extrabold text-[11px] text-amber-900 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-700" /> 121 PPK Lengkap
              </span>
              <p className="text-[10.5px] text-amber-800">
                Meliputi Endokrin, Gastro, Geriatri, HOM, Imun, Nefro, Paru, Remato, dan Tropik.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Langkah 1-2-3: Alur Kerja Cepat',
      subtitle: 'Dirancang Sangat Mudah untuk Dokter, Residen & Dokter Muda',
      category: 'Klinis PPK',
      icon: <Zap className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-2.5 text-xs text-slate-700">
          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-maroon-900 text-gold-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <div>
              <span className="font-bold text-slate-900">Input Catatan Medis:</span>
              <p className="text-[11px] text-slate-600">
                Sorot teks di SIMRS/EMR atau klik tombol <em>Coba Contoh Kasus</em> di bawah area input.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-maroon-900 text-gold-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <div>
              <span className="font-bold text-slate-900">Pilih 3 Mode Kerja:</span>
              <p className="text-[11px] text-slate-600">
                <strong>Jawab Konsul TS</strong> (Pre-Op / Raber / CITO), <strong>Periksa Pasien (POMR 4P)</strong>, atau <strong>Ringkas Kasus</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-maroon-900 text-gold-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              3
            </span>
            <div>
              <span className="font-bold text-slate-900">Salin Draf & Cek PPK:</span>
              <p className="text-[11px] text-slate-600">
                Tinjau rekomendasi obat, dosis penyesuaian ginjal/hati, kriteria ICU, lalu klik <em>Salin ke EMR</em>.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Penalaran 121 PPK & Penyesuaian Dosis',
      subtitle: 'Deteksi Multi-Masalah & Proteksi Keamanan Terapi',
      category: 'Klinis PPK',
      icon: <BookOpen className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-2.5 text-xs text-slate-700">
          <p className="leading-relaxed">
            Engine secara otomatis menganalisis lab abnormal dan tanda vital untuk:
          </p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Penyesuaian Dosis Organ:</strong> Menghitung eGFR (CKD-EPI) dan otomatis mengoreksi dosis antibiotik atau menahan obat nefrotoksik.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Prioritas CITO vs Elektif:</strong> Membedakan kondisi darurat yang memerlukan stabilisasi cito dengan rujukan algoritma PPK resmi.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Sitasi Dokumen Resmi:</strong> Setiap rekomendasi disertai rujukan nomor halaman dan edisi PPK PAPDI.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Fitur Baru: PPK Explorer (Cari Cepat)',
      subtitle: 'Buka & Baca Panduan Klinis Kapan Saja Tanpa Input Kasus',
      category: 'Klinis PPK',
      icon: <Search className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-2.5 text-xs text-slate-700">
          <p className="leading-relaxed">
            Sedang buru-buru di IGD atau Poli? Anda tidak perlu mengetik narasi kasus pasien:
          </p>
          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-maroon-900 text-xs">
              <Search className="w-4 h-4 text-maroon-800" />
              <span>Kolom Pencarian Langsung 121 PPK</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Cukup klik tombol <strong>"🔍 Cari Cepat PPK"</strong> di panel atas, ketik nama penyakit (misal: <em>KAD</em>, <em>Krisis Tiroid</em>, <em>SLE</em>, <em>Syok Septik</em>), dan kartu 4P beserta kriteria ICU akan langsung muncul dalam hitungan milidetik.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Pilar Riset & De-identifikasi Indonesia',
      subtitle: 'Standarisasi FHIR R4 & Sensor Data Pasien HIPAA/Indonesia',
      category: 'Riset & Privasi',
      icon: <Database className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-2.5 text-xs text-slate-700">
          <p className="leading-relaxed">
            Pada tab <strong>Research</strong>, Anda dapat mengubah rekam medis mentah menjadi data penelitian yang bersih dan berstandar internasional:
          </p>
          <div className="space-y-1.5">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong>Indonesian PHI Shield:</strong> Otomatis menyensor NIK 16-digit, Nomor BPJS, No. RM lokal, nomor HP/WA, dan alamat RT/RW.
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong>Interoperabilitas FHIR R4:</strong> Ekspor otomatis entitas klinis ke bundel FHIR R4 (Condition, Observation, Medication) serta CSV/JSON untuk publikasi riset.
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Cloud AI Opsional: Google Gemini (BYOK)',
      subtitle: 'Sintesis Narasi Luwes dengan Pre-Scrubbing Sensor Lokal',
      category: 'Cloud AI',
      icon: <KeyRound className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-2.5 text-xs text-slate-700">
          <p className="leading-relaxed">
            Bagi Anda yang menginginkan gaya penulisan narasi EMR yang lebih mengalir, Anda dapat menghubungkan Google Gemini API Key pribadi di tab <strong>Settings</strong>:
          </p>
          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5 text-[11px]">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span>Jaminan Privasi & Zero-Retention:</span>
            </div>
            <p className="text-slate-600 leading-snug">
              Teks pasien <strong>100% disensor menjadi token [PATIENT_1]</strong> di browser terlebih dahulu sebelum dikirim via parameter <code className="bg-slate-200 px-1 rounded font-mono font-bold">store: false</code>. Anda dapat mengintip teks tersensor ini kapan saja lewat tombol <strong>"🛡️ Pratinjau Sensor Privasi"</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Anda Siap Memulai!',
      subtitle: 'Mulai Pengalaman Bekerja Cepat & Aman dengan Internize 2.1',
      category: 'Klinis PPK',
      icon: <Sparkles className="w-6 h-6 text-gold-300" />,
      content: (
        <div className="space-y-3.5 text-xs text-center py-2">
          <p className="text-slate-700 leading-relaxed font-medium">
            Anda dapat membuka kembali panduan fitur ini kapan saja melalui tombol bantuan <span className="font-bold text-maroon-900 px-1.5 py-0.5 rounded bg-slate-200">?</span> di pojok kanan atas aplikasi.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => {
                onClose();
                onSelectSampleCase?.();
              }}
              className="w-full gap-2 bg-gradient-to-r from-maroon-900 to-maroon-800 text-gold-200 border border-gold-500/50 shadow-md font-bold text-xs"
            >
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span>Coba Contoh Kasus Klinis Sekarang (1 Klik)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full text-slate-600 text-xs"
            >
              Tutup Panduan & Buka Lembar Kerja Kosong
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="max-w-md flex flex-col p-0 overflow-hidden shadow-2xl"
    >
      {/* Tour Header with Progress */}
      <div className="bg-gradient-to-r from-maroon-900 via-maroon-950 to-slate-900 p-4 text-white border-b border-gold-600/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="primary" size="sm" className="bg-maroon-800 text-gold-300 font-bold border-gold-600/50 text-[10px]">
            {currentStep.category}
          </Badge>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gold-300/90 font-mono font-bold">
              {currentStepIndex + 1} dari {steps.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-maroon-800 border border-gold-500/50 flex items-center justify-center shrink-0 shadow-sm">
            {currentStep.icon}
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-gold-100 leading-tight">
              {currentStep.title}
            </h2>
            <p className="text-[10px] text-slate-300 font-medium mt-0.5">
              {currentStep.subtitle}
            </p>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mt-3 pt-2 border-t border-maroon-800/60">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all flex-1 ${
                idx === currentStepIndex
                  ? 'bg-gold-400'
                  : idx < currentStepIndex
                    ? 'bg-maroon-700'
                    : 'bg-slate-700/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tour Body */}
      <div className="p-4 bg-slate-50 min-h-[220px] flex flex-col justify-between">
        <div className="py-1">{currentStep.content}</div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-medium"
          >
            Lewati Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-8 px-2.5 text-xs gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Sebelumnya</span>
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              className="h-8 px-3 text-xs gap-1 bg-maroon-900 hover:bg-maroon-950 text-gold-200 border border-gold-500/50 font-bold"
            >
              <span>{isLast ? 'Selesai' : 'Lanjut'}</span>
              {!isLast && <ArrowRight className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
