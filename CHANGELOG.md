# Changelog — internize.ai

Dokumentasi riwayat pembaruan, perbaikan, dan rilis fitur klinis internize.ai.

---

## [2.2.0] — Internize 2.2 (Universal CDSS drguswib Integration & Precision Guardrails)
*Tanggal Rilis: 17 Oktober 2026*

### 🚀 Fitur Utama & Integrasi CDSS (drguswib Suite)
Integrasi penuh 8 suite Clinical Decision Support System (CDSS) dari portal klinis dr. Ida Bagus Indra Wibawa Putrawan, S.Ked ([https://sites.google.com/view/drguswib](https://sites.google.com/view/drguswib)) ke dalam `internize.ai` dengan eksekusi 100% on-device (Zero PHI Egress Invariant):

| Suite CDSS | Modul / Engine | Jumlah Tool / Obat | Fitur Unggulan & Guardrail Keselamatan Pasien |
| :--- | :--- | :---: | :--- |
| **ADJUSTR.IO** | `adjustrIoEngine.ts` | 36 Obat Antimikroba | Penyesuaian dosis ginjal Cockcroft-Gault, CKD-EPI 2021, IHD (dosis paska-HD), CRRT, neuro/nephrotoxicity guardrails, dan loading dose. |
| **Calc-Med Pro** | `calcMedFluidEngine.ts` | 8 Tools | Titrasi syringe pump vasopresor/inotropik (Norepinephrine, Dobutamine, Dopamine, Nicardipine, NTG), 24h bridging insulin, dan ABG/BGA Analyzer komprehensif (Henderson, Winter's formula, Figge corrected AG, Delta Ratio, P/F ratio, defisit NaHCO3). |
| **adjustr-fluid Pro** | `calcMedFluidEngine.ts` | 9 Tools | Kinetika natrium Adrogué-Madias dengan ODS ceiling guardrail ($\le 8\text{--}10\text{ mEq/24h}$), Free Water Deficit (FWD), manajemen kalium (IV limits vs triple drug), rumus Payne kalsium terkoreksi, rasio BUN:Cr (Ureum RS $\div 2.14$), dan kriteria AEIOU Cito HD. |
| **adjustrEMD Pro** | `adjustrEmdEngine.ts` | 18 Tools | Burch-Wartofsky Point Scale (BWPS), Myxedema Coma score dengan guardrail wajib Hydrocortisone sebelum Levothyroxine, DKA Severity & ADA Resolution Tracker dengan guardrail kalium $< 3.5$ ("TAHAN INSULIN"), Rumus 30 D40% PERKENI dengan guardrail aspirasi, Basal-Bolus TDD builder, TyG Index, HOMA-IR, Friedewald LDL ($TG > 400$ guardrail), AIP index, ASCVD 10-yr risk estimator, dan konversi HbA1c ke eAG. |
| **adjustr-GEH v2.2** | `adjustrGehEngine.ts` | 32 Tools | Glasgow-Blatchford Score (GBS), Oakland Score untuk LGIB, Child-Turcotte-Pugh (CTP), MELD Trio (Original, MELD-Na 2016, MELD 3.0), SAAG dengan alert SBP PMN $\ge 250/\mu\text{L}$ + rekomendasi Cefotaxime & Albumin, R-Factor (DILI) dengan Hy's Law mortality alert, De Ritis ratio, FIB-4 & APRI fibrosis, Maddrey Discriminant Function ($dF \ge 32$ severe alcoholic hepatitis + prednisolone), BISAP pankreatitis akut, dan Tokyo Guidelines 2018 (TG18). |
| **AdjustrHOM** | `adjustrHomEngine.ts` | 19 Tools | MASCC Risk Index, CISNE score, Cairo-Bishop Tumor Lysis Syndrome (Lab vs Clinical TLS), Calvert carboplatin formula dengan GFR 125 mL/min ceiling cap, Khorana cancer VTE score, 4Ts score untuk HIT (stop heparin alert), PLASMIC score untuk TTP dengan MANDATORY CRITICAL ALERT: Trombosit Kontraindikasi, CITO Plasma Exchange + Steroid, rumus defisit besi Ganzoni, dan estimator transfusi PRC. |
| **RheumaTools** | `rheumaToolsEngine.ts` | 16 Tools | Kriteria ACR/EULAR 2010 RA, kalkulator DAS28-CRP & DAS28-ESR dengan stratifikasi aktivitas remisi/rendah/sedang/tinggi, indeks flare MEX-SLEDAI bedside tanpa uji imunologis mahal, kriteria klasifikasi Gout ACR/EULAR 2015 dengan target tofus $< 5.0$, dan kriteria CASPAR PsA. |
| **Pre-Op & Geriatri** | `scoringCalculators.ts` | 6 Systems | RCRI Lee risk score, ARISCAT pulmonary risk, Caprini VTE risk, Delirium PAPDI risk, dan status toleransi operasi terstruktur. |

### 🛠️ Perbaikan UI & Auto-Focus
- **Penghapusan Tombol Sampel Redundan**: Menghilangkan tombol sampel duplikat di bagian atas `ClinicalServiceTab.tsx` dan merapikan label agar bersih dan ramah pengguna pemula.
- **PPK Explorer Mobile Scrolling & Focus**: Memperbaiki scroll view pada viewport `< 640px` dengan auto-focus sticky bar, mencegah duplikasi tombol tutup, dan memastikan konten dapat di-scroll lancar hingga bawah.
- **CDSS Explorer Modal Hub**: Modal pencarian interaktif responsif 8-suite dengan live parameter builder, validasi instan, guardrail alert banners bergradasi merah/kuning, dan tombol 1-klik `[Salin CPPT]` serta `[+ Sisipkan ke Draf]`.
- **Honest Null Over Fake Fallbacks**: Menghilangkan fallback default palsu (seperti `33`, `3.5`, `15`) pada kalkulator skoring klinis; kini secara jujur menampilkan `null` atau `Data Kurang` bila input klinis belum lengkap.

### 🧪 Verifikasi Pengujian & Keamanan
- 573 unit dan end-to-end test lulus 100% tanpa regresi.
- 0 TypeScript compiler errors (`tsc --noEmit`).
- Ukuran bundle ekstensi terkompresi: 8.4 MB (`internize-ai-extension.zip`).
- 100% on-device deterministic processing tanpa transmisi PHI ke cloud.

---

## [2.1.0] — Internize 2.1 (Security Hardening, UI Redesign, PPK Explorer & Onboarding Tour)
*Tanggal Rilis: 16 Oktober 2026*

### 🔒 Keamanan & Privasi PHI Indonesia
- Deteksi pola NIK (16 digit), BPJS Kesehatan (13 digit), No. Rekam Medis (`No. RM:`, `NRM:`), Telepon lokal (`08xx`, `+628xx`), Gelar/Sapaan (`Tn.`, `Ny.`, `An.`, `Sdr.`), dan alamat Indonesia.
- Auto-expire TTL 12 jam pada draft penyimpanan lokal komputer bersama.
- Panic button 1-klik untuk pembersihan total sesi pasien (`clearAllPatientSessions`).

### 📚 PPK Explorer Sp.PD (121 Panduan)
- Katalog instan 121 PPK PAPDI di 9 divisi dengan algoritma 4P (`Pdx`, `Ptx`, `Pmx`, `Pex`), kriteria ICU, dan sitasi resmi.

### 🧭 Interactive Onboarding Tour (3 Pilar)
- Panduan interaktif pertama kali bagi pengguna untuk alur klinis PPK, riset de-identifikasi HIPAA/FHIR, dan integrasi API Gemini Pribadi (BYOK) dengan pre-scrubbing sensor privasi.
