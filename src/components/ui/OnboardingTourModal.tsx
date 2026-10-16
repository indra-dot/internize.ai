import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  KeyRound,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSampleCase?: () => void;
  onSelectSampleCase?: () => void;
  initialStep?: number;
}

export interface OnboardingTourStepData {
  step: number; // 1-7
  pillarNumber: 1 | 2 | 3 | 0; // 0 for completion/start
  pillar: string; // e.g. 'Pilar 1: Klinis PPK'
  category: 'Klinis PPK' | 'Riset HIPAA/FHIR' | 'Gemini Pribadi BYOK' | 'Siap Pakai';
  title: string;
  subtitle: string;
  summary: string;
}

export const ONBOARDING_TOUR_STEPS: OnboardingTourStepData[] = [
  {
    step: 1,
    pillarNumber: 1,
    pillar: 'Pilar 1: Klinis PPK',
    category: 'Klinis PPK',
    title: 'Selamat Datang di Internize 2.1',
    subtitle: 'Asisten Klinis & Riset Sp.PD Berbasis 121 PPK PAPDI',
    summary:
      'Asisten cerdas Sp.PD yang beroperasi 100% on-device di browser tanpa kebocoran PHI (Zero PHI Egress), diperkuat 121 PPK dari 9 divisi PAPDI.',
  },
  {
    step: 2,
    pillarNumber: 1,
    pillar: 'Pilar 1: Klinis PPK',
    category: 'Klinis PPK',
    title: 'Langkah 1-2-3 Alur Kerja Klinis',
    subtitle: 'Alur Kerja 3 Langkah Cepat & Ramah Pemula',
    summary:
      '1. Input Catatan Medis (sorot di EMR atau 1-klik contoh kasus). 2. Pilih Mode (Jawab Konsul TS, POMR Bangsal, atau Ringkas Kasus). 3. Salin Draf EMR & telusuri PPK.',
  },
  {
    step: 3,
    pillarNumber: 1,
    pillar: 'Pilar 1: Klinis PPK',
    category: 'Klinis PPK',
    title: 'Mesin Pengetahuan 121 PPK & Penyesuaian Dosis Organ',
    subtitle: 'Algoritma PAPDI, Kriteria CITO vs Elektif & eGFR CKD-EPI',
    summary:
      'Kalkulasi risiko perioperatif (RCRI Lee, Caprini), estimasi eGFR CKD-EPI otomatis, prioritas CITO vs Elektif, penyesuaian dosis obat nefrotoksik/hepatotoksik, dan sitasi PPK resmi.',
  },
  {
    step: 4,
    pillarNumber: 1,
    pillar: 'Pilar 1: Klinis PPK',
    category: 'Klinis PPK',
    title: 'Cari Cepat Panduan Klinis (PPK Explorer)',
    subtitle: 'Buka Algoritma 4P & Kriteria Rujuk/ICU Seketika',
    summary:
      'Fitur Cari Cepat untuk mencari dan membaca langsung panduan diagnosis, terapi lini 1 & 2, titrasi syringe pump, serta kriteria ICU tanpa perlu input kasus.',
  },
  {
    step: 5,
    pillarNumber: 2,
    pillar: 'Pilar 2: Riset HIPAA/FHIR',
    category: 'Riset HIPAA/FHIR',
    title: 'Riset Klinis, De-identifikasi HIPAA/Indonesia & Konversi FHIR R4',
    subtitle: 'Sanitasi NIK, BPJS, No. RM & Standar Interoperabilitas Global',
    summary:
      'Tab Research menyensor otomatis 18 identifier HIPAA Safe Harbor serta identitas Indonesia (NIK 16 digit, BPJS 13 digit, No. RM lokal) dan mengonversi lab ke FHIR R4 Bundle.',
  },
  {
    step: 6,
    pillarNumber: 3,
    pillar: 'Pilar 3: Gemini Pribadi BYOK',
    category: 'Gemini Pribadi BYOK',
    title: 'API Gemini Pribadi (BYOK) dengan Pre-Scrubbing Sensor Otomatis',
    subtitle: 'Penalaran Lanjut Tanpa Kompromi Privasi',
    summary:
      'Gunakan Google Gemini API Key sendiri (BYOK) dengan jaminan pre-scrubbing sensor lokal 100% dan parameter store: false untuk zero cloud retention.',
  },
  {
    step: 7,
    pillarNumber: 0,
    pillar: 'Siap Pakai',
    category: 'Siap Pakai',
    title: 'Siap Memulai Telaah Kasus!',
    subtitle: 'Mulai Praktik Klinis Cepat, Terstruktur & Aman',
    summary:
      'Klik tombol di bawah untuk langsung mencoba contoh kasus Pre-Operatif Bedah dan melihat Internize 2.1 menyusun draf konsultasi secara instan.',
  },
];

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartSampleCase,
  onSelectSampleCase,
  initialStep = 0,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStep);

  if (!isOpen) return null;

  const currentStepData = ONBOARDING_TOUR_STEPS[currentStepIndex] || ONBOARDING_TOUR_STEPS[0];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === ONBOARDING_TOUR_STEPS.length - 1;

  const handleStartSample = () => {
    onClose();
    if (onStartSampleCase) {
      onStartSampleCase();
    } else if (onSelectSampleCase) {
      onSelectSampleCase();
    }
  };

  const handleNext = () => {
    if (isLast) {
      handleStartSample();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Step icons
  const getStepIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Stethoscope className="w-5 h-5 text-gold-300" />;
      case 1:
        return <Layers className="w-5 h-5 text-gold-300" />;
      case 2:
        return <HeartPulse className="w-5 h-5 text-gold-300" />;
      case 3:
        return <Search className="w-5 h-5 text-gold-300" />;
      case 4:
        return <FileSpreadsheet className="w-5 h-5 text-gold-300" />;
      case 5:
        return <KeyRound className="w-5 h-5 text-gold-300" />;
      case 6:
        return <Sparkles className="w-5 h-5 text-gold-300" />;
      default:
        return <BookOpen className="w-5 h-5 text-gold-300" />;
    }
  };

  // Step custom content render
  const renderStepContent = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="space-y-3 text-xs leading-relaxed text-slate-700">
            <p>
              <strong className="text-maroon-950 font-bold">internize.ai</strong> kini diperbarui ke
              versi <strong className="text-maroon-900 font-extrabold">Internize 2.1</strong> dengan
              otak klinis baru:{' '}
              <strong className="text-slate-900">
                121 Panduan Praktik Klinis (PPK) &amp; Clinical Pathways
              </strong>{' '}
              dari 9 divisi PAPDI.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-maroon-50 border border-maroon-200 space-y-1">
                <span className="font-extrabold text-[11px] text-maroon-900 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" /> 100% On-Device
                </span>
                <p className="text-[10.5px] text-maroon-800">
                  Semua data pasien diproses di dalam browser Anda tanpa transmisi ke server cloud
                  (Zero PHI Egress).
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
        );

      case 1:
        return (
          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
              <span className="w-5 h-5 rounded-full bg-maroon-900 text-gold-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <div>
                <span className="font-bold text-slate-900">Input Catatan Medis:</span>
                <p className="text-[11px] text-slate-600">
                  Sorot teks di SIMRS/EMR atau klik tombol <em>Coba Contoh Kasus</em> di bawah area
                  input.
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
                  <strong>Jawab Konsul TS</strong> (Pre-Op / Raber / CITO),{' '}
                  <strong>Periksa Pasien (POMR 4P)</strong>, atau <strong>Ringkas Kasus</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200">
              <span className="w-5 h-5 rounded-full bg-maroon-900 text-gold-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                3
              </span>
              <div>
                <span className="font-bold text-slate-900">Salin Draf &amp; Cek PPK:</span>
                <p className="text-[11px] text-slate-600">
                  Tinjau rekomendasi obat, dosis penyesuaian ginjal/hati, kriteria ICU, lalu klik{' '}
                  <em>Salin ke EMR</em>.
                </p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-2.5 text-xs text-slate-700">
            <p className="leading-relaxed">
              Engine secara otomatis menganalisis lab abnormal dan tanda vital untuk:
            </p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Penyesuaian Dosis Organ:</strong> Menghitung eGFR (CKD-EPI) dan otomatis
                  mengoreksi dosis antibiotik atau menandai obat nefrotoksik.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Prioritas CITO vs Elektif:</strong> Membedakan kondisi darurat yang
                  memerlukan stabilisasi CITO dengan rujukan algoritma PPK resmi.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Sitasi Dokumen Resmi:</strong> Setiap rekomendasi disertai rujukan nomor
                  halaman dan edisi PPK PAPDI.
                </span>
              </li>
            </ul>
          </div>
        );

      case 3:
        return (
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
                Cukup klik tombol <strong>"🔍 Cari Cepat PPK"</strong> di panel atas, ketik nama
                penyakit (misal: <em>KAD</em>, <em>Krisis Tiroid</em>, <em>SLE</em>,{' '}
                <em>Syok Septik</em>), dan kartu 4P beserta kriteria ICU akan langsung muncul dalam
                hitungan milidetik.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-2.5 text-xs text-slate-700">
            <p className="leading-relaxed">
              Pada tab <strong>Research</strong>, Anda dapat mengubah rekam medis mentah menjadi
              data penelitian yang bersih dan berstandar internasional:
            </p>
            <div className="space-y-1.5">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <strong>Indonesian PHI Shield:</strong> Otomatis menyensor NIK 16-digit, Nomor
                  BPJS 13-digit, No. RM lokal, nomor HP/WA, dan alamat RT/RW.
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <strong>Interoperabilitas FHIR R4:</strong> Ekspor otomatis entitas klinis ke
                  bundel FHIR R4 (Condition, Observation, Medication) serta CSV/JSON untuk publikasi
                  riset.
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-2.5 text-xs text-slate-700">
            <p className="leading-relaxed">
              Bagi Anda yang menginginkan gaya penulisan narasi EMR yang lebih mengalir, Anda dapat
              menghubungkan Google Gemini API Key pribadi di tab <strong>Settings</strong>:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5 text-[11px]">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-700" />
                <span>Jaminan Privasi &amp; Zero-Retention:</span>
              </div>
              <p className="text-slate-600 leading-snug">
                Teks pasien <strong>100% disensor menjadi token [PATIENT_1]</strong> di browser
                terlebih dahulu sebelum dikirim via parameter{' '}
                <code className="bg-slate-200 px-1 rounded font-mono font-bold">store: false</code>.
                Anda dapat mengintip teks tersensor ini kapan saja lewat tombol{' '}
                <strong>"🛡️ Pratinjau Sensor Privasi"</strong>.
              </p>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-3.5 text-xs text-center py-2">
            <p className="text-slate-700 leading-relaxed font-medium">
              Anda dapat membuka kembali panduan fitur ini kapan saja melalui tombol bantuan{' '}
              <span className="font-bold text-maroon-900 px-1.5 py-0.5 rounded bg-slate-200">
                ?
              </span>{' '}
              di pojok kanan atas aplikasi.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                data-testid="tour-start-sample-btn"
                onClick={handleStartSample}
                className="w-full gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:to-amber-500 text-maroon-950 border border-amber-300 shadow-md font-bold text-xs"
              >
                <Sparkles className="w-4 h-4 text-maroon-900" />
                <span>Coba Contoh Kasus Pre-Op (1-Klik)</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="w-full text-slate-600 text-xs hover:bg-slate-100"
              >
                Tutup Panduan &amp; Buka Lembar Kerja Kosong
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      hideCloseButton={true}
      bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
      className="max-w-md flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-maroon-800/40"
    >
      <div data-testid="onboarding-tour-modal" className="flex flex-col flex-1">
        {/* Tour Header with Progress */}
        <div className="bg-gradient-to-r from-maroon-900 via-maroon-950 to-slate-900 p-4 text-white border-b border-gold-600/40 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <Badge
              variant="primary"
              size="sm"
              data-testid="tour-pillar-badge"
              className="bg-maroon-800 text-gold-300 font-bold border-gold-600/50 text-[10px]"
            >
              {currentStepData.pillar}
            </Badge>
            <div className="flex items-center gap-1.5">
              <span
                data-testid="tour-step-counter"
                className="text-[10px] text-gold-300/90 font-mono font-bold"
              >
                {`Langkah ${currentStepIndex + 1} dari ${ONBOARDING_TOUR_STEPS.length}`}
              </span>
              <button
                type="button"
                data-testid="tour-close-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Tutup Tour"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-maroon-800 border border-gold-500/50 flex items-center justify-center shrink-0 shadow-sm">
              {getStepIcon(currentStepIndex)}
            </div>
            <div>
              <h2
                data-testid="tour-step-title"
                className="text-sm font-extrabold text-gold-100 leading-tight"
              >
                {currentStepData.title}
              </h2>
              <p
                data-testid="tour-step-subtitle"
                className="text-[10px] text-slate-300 font-medium mt-0.5"
              >
                {currentStepData.subtitle}
              </p>
            </div>
          </div>

          {/* Step dots */}
          <div
            data-testid="tour-step-dots"
            className="flex items-center gap-1.5 mt-3 pt-2 border-t border-maroon-800/60"
          >
            {ONBOARDING_TOUR_STEPS.map((stepItem, idx) => (
              <button
                key={`tour-step-dot-${stepItem.step}`}
                type="button"
                data-testid={`tour-dot-${idx}`}
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={`Pindah ke langkah ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'bg-gold-400 w-6'
                    : idx < currentStepIndex
                      ? 'bg-maroon-700 w-2.5 hover:bg-gold-500/60'
                      : 'bg-slate-700/60 w-2.5 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tour Body */}
        <div className="p-4 bg-slate-50 min-h-[220px] flex flex-col justify-between">
          <div data-testid="tour-step-content" className="py-1">
            {renderStepContent(currentStepIndex)}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
            <button
              type="button"
              data-testid="tour-skip-btn"
              onClick={onClose}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer"
            >
              Lewati Tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="tour-prev-btn"
                  onClick={handlePrev}
                  className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Sebelumnya</span>
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="tour-next-btn"
                onClick={handleNext}
                className={`h-8 px-3 text-xs gap-1 cursor-pointer font-bold ${
                  isLast
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-maroon-950 border border-amber-300 shadow-sm'
                    : 'bg-maroon-900 hover:bg-maroon-950 text-gold-200 border border-gold-500/50'
                }`}
              >
                <span>{isLast ? 'Mulai Coba Contoh Kasus' : 'Lanjut'}</span>
                {!isLast && <ArrowRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingTourModal;
