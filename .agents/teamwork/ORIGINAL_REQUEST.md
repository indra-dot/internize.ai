# Original User Request

## 2026-09-27T10:34:09Z

Redesign the clinical engine and user interface of internize.ai to operate primarily on deterministic, sub-10ms CROGE rules with an on-demand local Neural SLM toggle, OpenMed-aligned NER/PII de-identification/ontology mapping, a binary perioperative urgency classification (Elektif vs Life-Saving Emergensi), and a 3-column Sp.PD clinical workflow interface.

Working directory: c:\Users\Wib PC\Documents\Project\myproject\internize.ai
Integrity mode: development

## Requirements

### R1. Deterministic CROGE Primary Engine & On-Demand Neural SLM Toggle
- Default execution path must be 100% deterministic CROGE running locally in <15ms without invoking neural model pipelines or downloading weights.
- Integrate OpenMed-aligned PII scrubbing/de-identification prior to downstream analysis layers, and extract clinical entities mapped deterministically to SNOMED CT and RxNorm.
- Provide an explicit user toggle: "⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)" (default: OFF / Unloaded) with an informative tooltip ("Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik.").
- Only when explicitly toggled ON will the system invoke `generateDirectedClinicalAnalysis` injected with CROGE-verified facts.

### R2. Binary Perioperative Urgency Redesign
- Deprecate legacy consultation presets (`preop`, `raber`, `akut`) and implement the binary dichotomy: `export type SurgicalUrgencyType = 'elektif' | 'life_saving';`.
- **Operasi Elektif Terencana (`elektif`)**:
  - Focus on procedural safety and contraindication screening.
  - Critical thresholds trigger "TUNDA OPERASI ELEKTIF":
    - Kalium < 2.5 or >= 6.0 mEq/L
    - Trombosit < 100.000 /uL (Neurosurgery) or < 50.000 /uL (General Surgery)
    - GDS >= 350 mg/dL or DKA/HHS
    - BP Systolic >= 180 mmHg or Diastolic >= 110 mmHg
    - Active uncontrolled sepsis/bacteremia
    - Severe anemia (Hb < 7.5 g/dL)
  - Generate CITO pre-operative stabilization goals to reach safe hemodynamic & lab targets. If controlled, output "LAIK OPERASI" or "LAIK OPERASI DENGAN CATATAN".
- **Operasi CITO / Emergensi / Life-Saving (`life_saving`)**:
  - For life-threatening emergencies (e.g. ruptured cerebral aneurysm, intracranial herniation, massive hemorrhage, perforated peritonitis), penundaan is contraindicated.
  - Output status: "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL".
  - Shift Sp.PD plan entirely to parallel emergency support:
    - Pre-Op: Immediate blood/TC/FFP preparation at OR table, central venous catheter (CVC) access.
    - Intra-Op: Simultaneous correction (e.g. slow KCl syringe pump infusion in OR, specific intraoperative MAP targets, continuous ECG monitoring for lethal arrhythmias).
    - Post-Op: Mandatory intensive care transfer (ICU/HCU), serial lab/electrolyte evaluation 2-4 hours post-op.

### R3. Three-Column Clinical Workflow UI (`SpPdWorkflowPanel.tsx`)
- Restructure the UI into a 3-column layout reflecting the Sp.PD daily workflow:
  - **Column 1 (Left ~38%): POMR CPPT Bangsal (Periksa Pasien)**
    - Official Sp.PD CPPT header (timestamp & DPJP).
    - S & O section integrating vitals and lab trends.
    - Ordered problem list categorized by the 11 PAPDI divisions (#1, #2, #3...), each featuring the 4 pillars:
      - Pdx (Diagnostic Plan)
      - Ptx (Detailed Medical Therapy Plan)
      - Pmx (Monitoring Plan: lab/vital targets)
      - Pex (Patient/Family Education Plan)
    - Actions: "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis".
  - **Column 2 (Center ~34%): Lembar Jawaban Konsul TS**
    - Segmented binary switch: [ Operasi Elektif Terencana ] vs [ Operasi CITO / Life-Saving ].
    - Tolerance status banner:
      - Green/Yellow: Laik / Laik dengan Catatan.
      - Red: Tunda Operasi (Elektif).
      - Orange-Red: Prosedur Berjalan dengan Stabilisasi CITO Paralel (Life-Saving).
    - Structured surgical advis: Pre-Operative, Intra-Operative, Post-Operative & Co-Management (ICU/Ward).
    - Action: "Salin Surat Jawaban Konsul".
  - **Column 3 (Right ~28%): Drug-Drug Interaction & Renal/Hepatic Safety Guard**
    - Renal Dose Adjustment Monitor: Automated eGFR / CrCl estimation from serum creatinine with flags for nephrotoxic drugs or dose adjustments (e.g. Vancomycin, Aminoglycosides, ACEi/ARB, Metformin).
    - Hepatic Impairment Alert: Warning when AST/ALT > 3x ULN for hepatotoxic regimens (high-dose Paracetamol, Statins, antifungals/antibiotics).
    - Critical Drug Interaction & Electrolyte Hazards: Warning for lethal arrhythmia risk (QTc prolonging drugs like fluoroquinolones, macrolides, ondansetron combined with severe hypokalemia/hypomagnesemia); warning for hemostasis hazards (anticoagulant/antiplatelet with neurosurgical thrombocytopenia).
    - Serial Lab Trend Snapshot: Quick multi-date trend summary of critical markers (K, PLT, LCS Glucose, etc.).

### R4. Architectural & Zero Egress Constraints
- Strict in-browser/local execution. No patient data or PHI may be transmitted over network APIs.
- Preserve Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual branding.

## Acceptance Criteria

### Engine Verification
- [ ] CROGE core analysis executes in < 15ms in automated benchmarks.
- [ ] Neural SLM engine remains uninitialized/unloaded until the user explicitly toggles it ON.
- [ ] PII redaction executes prior to entity extraction and clinical categorization.

### Urgency Logic Verification
- [ ] In 'elektif' mode, a simulated patient with K 1.87 mEq/L and PLT 54,000 /uL returns status containing "TUNDA OPERASI ELEKTIF" and pre-op stabilization targets.
- [ ] When switched to 'life_saving' mode, the same patient returns status "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" and does not contain delay/tunda directives.
- [ ] Advis correctly splits into Pre-Op, Intra-Op, and Post-Op actions tailored to the chosen urgency mode.

### UI & Guardrail Verification
- [ ] `SpPdWorkflowPanel.tsx` renders all 3 columns simultaneously on desktop viewports.
- [ ] Column 1 displays 4 pillars (Pdx, Ptx, Pmx, Pex) for each prioritized PAPDI problem.
- [ ] Column 3 correctly surfaces QTc prolongation warning when hypokalemia (K < 3.5) co-exists with QTc-prolonging drugs.
- [ ] Column 3 displays automated renal eGFR / CrCl and flags nephrotoxic medications.
- [ ] Automated tests pass cleanly: `npm test` exits with code 0 across all unit and e2e suites, and `npm run build` succeeds without type errors.


## 2026-10-11T12:23:54Z

# Teamwork Project Prompt — PPK-Grounded Clinical Intelligence (v2)

Jadikan internize.ai jauh lebih pintar dalam menjawab pertanyaan klinis Sp.PD dengan menjadikan 122 dokumen PPK/CP rumah sakit (9 divisi PAPDI, di `docs/ppk/`) sebagai sumber pengetahuan utama — dan buktikan peningkatannya lewat benchmark before/after yang dibekukan sebelum implementasi dimulai. Seluruh pemrosesan pasien tetap 100% on-device (zero PHI egress).

Working directory: `c:\Users\Wib PC\Documents\Project\myproject\internize.ai`
Integrity mode: development

## Konteks
- Sumber: `docs/ppk/{ENDOKRIN,GASTRO,GERIATRI,HOM,IMUN,NEFRO,PARU,REMATO,TROPIK}` — 119 PDF, 2 DOCX, 1 DOC. Folder ini rahasia, sudah di-`.gitignore`, dan TIDAK BOLEH di-commit/push dalam bentuk apa pun yang dapat dibaca ulang sebagai dokumen asli.
- Engine yang ada: CROGE deterministik, `protocolRegistry` (~38 protokol), `internalMedicineEngine`, 3 mode (Jawab Konsul TS, Periksa Pasien POMR, Ringkas Kasus). Aturan wajib di `GEMINI.md` berlaku penuh.
- Di luar cakupan: jangan ubah `src/services/gemini/`, `cloudSynthesizer.ts`, dan `cloudGuardrail.ts` (jalur cloud yang sudah disensor CROGE). Peningkatan kecerdasan harus dicapai di jalur on-device; skor benchmark diukur tanpa jalur cloud.

## Requirements

### R1. Cakupan pengetahuan PPK penuh
Seluruh 122 dokumen diolah menjadi pengetahuan yang dapat dipakai engine: kriteria diagnosis, pemeriksaan penunjang (Pdx), terapi lini 1/2 beserta dosis, kontraindikasi, dan penyesuaian (ginjal/hati/geriatri) (Ptx), target & frekuensi monitoring (Pmx), edukasi (Pex), kriteria rujuk/ICU/pulang, serta skor dan tabel titrasi bila ada. Dokumen yang gagal diolah harus dilaporkan, bukan dilewati diam-diam.

### R2. Penalaran klinis berbasis PPK
Untuk input kasus atau pertanyaan dokter, sistem harus:
- Mengenali masalah aktif (termasuk multi-problem lintas divisi, mis. KAD + sepsis + AKI) dan memilih PPK yang relevan.
- Menyesuaikan rekomendasi dengan data pasien (lab, vital, komorbid, obat yang sedang dipakai): mis. menahan metformin bila eGFR rendah, menyesuaikan dosis antibiotik, menandai interaksi/kontraindikasi.
- Memprioritaskan tindakan CITO vs elektif.
- Menyatakan dengan jujur bila PPK tidak mencakup pertanyaan (tidak mengarang).
- Menyertakan sitasi ke dokumen & bagian PPK yang mendasari setiap rekomendasi.
- Terintegrasi ke ketiga mode yang sudah ada, bukan fitur terpisah.

### R3. Privasi & kerahasiaan
Semua inferensi atas teks pasien berjalan lokal di browser (tanpa LLM cloud). Representasi PPK yang dibundel ke ekstensi tidak boleh berupa salinan dokumen yang mudah dibaca/diekstrak ulang oleh manusia, dan identitas RS/penyusun dihapus. Dokumen asli tidak pernah masuk git.

### R4. Benchmark before/after yang dibekukan
Sebelum mengubah engine, susun benchmark kasus klinis yang di-*freeze* (hash dicatat), lalu ukur skor baseline engine saat ini. Benchmark:
- Min. 150 item, mencakup ke-9 divisi (min. 8 per divisi; IMUN boleh lebih sedikit sesuai isi), dan semua jenis pertanyaan: diagnosis/kriteria, Pdx, Ptx+dosis, penyesuaian dosis/kontraindikasi, Pmx/target, kriteria rujuk/ICU, multi-problem, dan pertanyaan di luar cakupan PPK.
- Setiap item memiliki jawaban kunci dengan rujukan ke dokumen PPK + item "red flag" (jawaban yang berbahaya bila muncul).
- Item disusun sepenuhnya oleh agen yang terpisah dari tim implementasi (tanpa review manusia). Karena itu, setiap jawaban kunci harus diverifikasi silang oleh agen kedua yang independen terhadap teks PPK; item yang diperdebatkan atau tidak didukung PPK dibuang sebelum di-freeze.
- ~20% item disimpan sebagai *hidden set* yang tidak dilihat tim implementasi sampai evaluasi akhir.
- Penilaian dilakukan oleh grader/agen yang bukan implementer, dengan rubrik per item (benar / sebagian / salah / red flag).
- Dapat dijalankan dengan satu perintah dan menghasilkan laporan per divisi & per jenis pertanyaan.

## Acceptance Criteria

### Peningkatan kecerdasan (diukur di benchmark yang dibekukan)
- [ ] Skor total ≥ 85% DAN naik ≥ 40 poin persentase dari baseline.
- [ ] Setiap divisi ≥ 75%; setiap jenis pertanyaan ≥ 75%.
- [ ] Hidden set ≥ 80% (selisih dengan set terbuka ≤ 10 poin — mencegah overfitting).
- [ ] Akurasi sitasi ≥ 90% (dokumen PPK yang dirujuk benar mendukung jawaban).
- [ ] **0 red flag** (dosis salah ≥2x, obat kontraindikasi, melewatkan tindakan CITO).
- [ ] Pertanyaan di luar cakupan: ≥ 90% dijawab "tidak tercakup PPK", bukan dikarang.

### Cakupan
- [ ] Laporan ingestion: ≥ 95% dari 122 dokumen terolah, sisanya terdaftar beserta alasannya.

### Privasi, keamanan, regresi
- [ ] Uji otomatis membuktikan tidak ada network request saat memproses teks pasien.
- [ ] `git ls-files` tidak memuat file dari `docs/ppk/` atau teks PPK mentah.
- [ ] Seluruh test lama + baru lulus; `npm run build` bersih tanpa error TypeScript.
- [ ] Waktu respons per kasus di laptop biasa ≤ 3 detik (setelah model/knowledge dimuat).


## 2026-10-12T00:10:21Z

Lanjutkan pekerjaan sekarang:
1. Spawning successor orchestrator (Gen 2) untuk mengambil alih dari handoff.md di orchestrator_ppk_1.
2. Selesaikan verifikasi gerbang M1 (validasi 164 item, SHA-256 freeze, baseline 14.0%), terbitkan TEST_READY.md.
3. Langsung mulai Milestone 2 (ingestion 122 PPK, OCR lokal, sanitasi tanpa commit git).
Kirim update progress secara berkala.


## 2026-10-12T14:07:01Z

Lanjutkan pekerjaan:
Server baru saja restart. Mohon lanjutkan dari Milestone 4 (review worker_m4_1 -> gate check M4) lalu selesaikan Milestone 5 (Benchmark Verification & Adversarial Hardening).
Saat ini progress engine sudah menghasilkan 0 red flags dan citation accuracy 97.3%. Teruskan proses hingga target acceptance criteria terpenuhi (skor >= 85%, gain >= 40pp). Laporkan status berkala.


## 2026-10-16T10:30:00Z

User meminta melanjutkan dengan model flash agar hemat kuota dan cepat. Lanjutkan penyelesaian Milestone 5 sampai selesai.


## 2026-10-16T13:05:49Z

# Teamwork Project Prompt — Internize 2.1 (Security Hardening, UI Redesign, PPK Explorer & Onboarding Tour)

> Status: Launched
> Goal: Eksekusi komprehensif Internize 2.1, verifikasi test, build & push ke GitHub.
> Requested team: [none — teamwork routes from the description]

Eksekusi seluruh rencana peningkatan untuk **Internize 2.1** (versi 2.1.0) pada codebase `internize.ai`: penguatan keamanan PHI Indonesia (NIK/BPJS/HP/RM), auto-expire draft, fitur Cari Cepat 121 PPK (PPK Explorer), perombakan UI ramah pemula (Langkah 1-2-3), Interactive Onboarding Tour 3 pilar (Klinis PPK, Riset HIPAA/FHIR, API Gemini Pribadi BYOK), bump versi ke 2.1.0, verifikasi seluruh test, dan update ke GitHub.

Working directory: `c:\Users\Wib PC\Documents\Project\myproject\internize.ai`
Integrity mode: development

## Requirements

### R1. Penguatan Keamanan & Privasi Indonesia (Indonesian PHI Shield & Storage Hardening)
- Perkuat `src/services/deid/deidentifier.ts` dan `src/services/clinical/cloudGuardrail.ts` dengan pola PHI Indonesia:
  - NIK (16 digit angka)
  - Nomor BPJS Kesehatan (13 digit angka)
  - Nomor Rekam Medis lokal (`No. RM:`, `RM:`, `NRM:`, `Rekam Medis:`)
  - Nomor Telepon Indonesia (`08xx-xxxx-xxxx`, `+628xx...`)
  - Gelar/Sapaan Nama Indonesia (`Tn.`, `Ny.`, `Nn.`, `An.`, `Sdr.`, `Bp.`, `Ibu`)
  - Alamat Indonesia (`Jl.`, `Jalan`, `RT/RW`, `Kel.`, `Kec.`, `Kab.`, `Kota`)
- Perkuat `src/services/storage/chromeStorage.ts`:
  - Tambahkan Auto-Expire (TTL 12 jam) pada `clinicalDraft` dan `researchDraft` agar data pasien tidak tertinggal permanen di komputer bersama.
  - Sediakan fungsi `clearAllPatientSessions()` untuk tombol pembersih cepat 1-klik di UI.
  - Pindahkan penyimpanan kunci kredensial Supabase dari `chrome.storage.sync` ke `chrome.storage.local`.

### R2. Fitur Pencarian Cepat 121 PPK (PPK Explorer) & Transparansi Sensor Gemini
- Sediakan antarmuka "Cari Cepat PPK" di panel klinis agar dokter/koas dapat langsung mencari dan membaca algoritma 4P (`Pdx`, `Ptx + Dosis`, `Pmx`, `Pex`), kriteria ICU/rujuk, dan sitasi dari 121 PPK tanpa harus menempelkan kasus pasien panjang.
- Sediakan tombol "Pratinjau Sensor Privasi" saat menggunakan mode Cloud Gemini Synthesizer, sehingga dokter dapat melihat bukti bahwa identitas pasien sudah disensor menjadi token sebelum dikirim ke Google Gemini.

### R3. Redesign UI Ramah Pemula (Beginner User-Friendly & Langkah 1-2-3)
- Rombak `SpPdWorkflowPanel.tsx` dan `ClinicalServiceTab.tsx`:
  - Tambahkan banner visual panduan langkah kerja: **Langkah 1 (Input/Contoh Kasus)** -> **Langkah 2 (Pilih Mode: Konsul/POMR/Ringkas)** -> **Langkah 3 (Salin Draf & Cek PPK)**.
  - Sederhanakan istilah teknis (jelaskan singkatan POMR, 4P, CROGE, BYOK dengan tooltip bahasa manusiawi).
  - Tampilkan tombol contoh kasus 1-klik di posisi yang mencolok dan mudah dicoba pertama kali.
  - Sediakan tombol "Bersihkan Sesi" (Panic/Wipe Button) yang mudah diakses di header.
  - Tetap pertahankan identitas visual Deep Maroon (`#4A151B`) dan Warm Gold (`#CDA258`).

### R4. Interactive First-Time User Onboarding Tour (3 Pilar: Klinis, Riset, Gemini Pribadi)
- Buat komponen tour interaktif `src/components/ui/OnboardingTourModal.tsx` yang muncul otomatis saat pengguna pertama kali membuka Internize 2.1 (status `hasCompletedTour_v2_1` disimpan di local storage), serta dapat dipanggil ulang kapan saja lewat tombol bantuan `?` di header.
- Tour mencakup 7 langkah edukatif:
  1. Welcome to Internize 2.1 (Asisten Klinis & Riset Sp.PD berbasis 121 PPK)
  2. Langkah 1-2-3 Alur Kerja Klinis (Konsul, POMR, Ringkas Kasus)
  3. Mesin Pengetahuan 121 PPK & Penyesuaian Dosis Organ
  4. Cari Cepat Panduan Klinis (PPK Explorer)
  5. Riset Klinis, De-identifikasi HIPAA/Indonesia & Konversi FHIR R4 (Tab Research)
  6. API Gemini Pribadi (BYOK) dengan Pre-Scrubbing Sensor Otomatis
  7. Siap Memulai (Tombol Mulai Coba Contoh Kasus)

### R5. Versioning Internize 2.1, Build, Testing & Git Sync
- Naikkan nomor versi ke `2.1.0` di `package.json`, `public/manifest.json`, header UI ("Internize 2.1"), dan `SettingsTab.tsx`.
- Pastikan seluruh test unit & integrasi lulus (`npm run test:run` atau `npx vitest run`).
- Pastikan `npm run build` sukses tanpa error TypeScript.
- Perbarui file zip ekstensi `internize-ai-extension.zip`.
- Commit perubahan, buat git tag `v2.1.0`, push branch ke remote GitHub, dan buatkan tabel ringkasan changelog untuk pengguna.

## Acceptance Criteria
- [ ] Sensor PHI Indonesia (NIK, BPJS, HP lokal, RM lokal, sapaan Tn/Ny) lolos uji unit dan terintegrasi di `deidentifier.ts`.
- [ ] TTL draft 12 jam dan fungsi pembersihan sesi berfungsi di `chromeStorage.ts`.
- [ ] Fitur Cari Cepat 121 PPK dapat diakses dan merender informasi diagnosis, terapi, monitoring, dan sitasi PPK secara instan.
- [ ] UI menampilkan panduan Langkah 1-2-3 yang intuitif untuk pemula dengan tombol contoh kasus 1-klik.
- [ ] Tour Onboarding v2.1 muncul pertama kali dan mencakup 3 pilar (Klinis PPK, Riset HIPAA/FHIR, API Gemini BYOK).
- [ ] Versi tercatat resmi sebagai `2.1.0` / "Internize 2.1" di `package.json`, `manifest.json`, dan UI.
- [ ] Seluruh unit test lulus 100% dan `npm run build` sukses.
- [ ] Git commit & push berhasil ke repository GitHub.
