# Panduan Kontribusi (Contributing Guide) — internize.ai

Terima kasih telah tertarik untuk berkontribusi pada **internize.ai**! 🩺✨

Proyek ini dibangun secara open-source untuk memajukan digitalisasi klinis dokter spesialis penyakit dalam (Sp.PD), residen, dokter umum, dan peneliti medis di Indonesia dengan mengutamakan privasi 100% lokal (*zero egress*).

Baik Anda seorang **dokter/klinisi**, **software engineer**, **data scientist**, atau **mahasiswa kedokteran & informatika**, kontribusi Anda sangat berharga bagi kemajuan pelayanan kesehatan di Indonesia.

---

## 🎯 Bidang Kontribusi yang Sangat Diharapkan

Anda dapat berkontribusi pada salah satu atau beberapa area berikut:

### 1. Standar & Protokol Klinis PAPDI (11 Subspesialisasi)
- Menambahkan atau memperbarui algoritma tata laksana dan protokol krisis:
  - **Endokrin-Metabolik**: KAD, HHS, Krisis Tiroid, Target Gula Darah Perioperatif.
  - **Ginjal-Hipertensi**: Krisis Hipertensi (Emergensi vs Urgensi), AKI staging KDIGO, penyesuaian dosis obat pada penurunan eGFR/CrCl.
  - **Tropik-Infeksi**: Sepsis 3, Dengue Warning Signs, Malaria, TB, Antibiotik empirik.
  - **Kardiologi**: Akut Koroner Sindrom, Gagal Jantung Akut, Aritmia & QTc drug hazards.
  - **Pulmonologi**: PPOK Eksaserbasi Akut, Asma Eksaserbasi Akut, Pneumonia (CURB-65).
  - **Gastroenterohepatologi**: Perdarahan Saluran Cerna Akut (Rockall / Blatchford), Sirosis & Ensefalopati Hepatikum.
  - **Hematologi-Onkologi**: Staging TNM AJCC edisi ke-8, konversi ECOG PS, DIC score, penanganan sindrom lisis tumor.
  - **Reumatologi**: Lupus Flare (SLEDAI), Gout Akut, Artritis Reumatoid.
  - **Alergi-Imunologi**: Anafilaksis, Sindrom Stevens-Johnson (SJS/TEN).
  - **Geriatri**: Skrining komprehensif geriatri (CGA), polifarmasi, instabilitas.
  - **Psikosomatik**: Gangguan somatoform, fungsional dyspepsia.
- Lokasi berkas: [`src/services/clinical/protocols/`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/protocols/) dan [`src/services/clinical/internalMedicineEngine.ts`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/internalMedicineEngine.ts).

### 2. Engine Parsing Singkatan & Format Rekam Medis Indonesia
- Menambah dan menyempurnakan parsing singkatan klinis lokal yang sering digunakan di bangsal/IGD/ICU Indonesia.
- **Guardrails yang wajib dijaga**:
  - `T:` atau `TD:` → Tensi / Tekanan Darah (BUKAN temperatur).
  - `N:` atau `HR:` → Nadi / Heart Rate.
  - `R:` atau `RR:` → Respirasi / Laju Napas.
  - `S:` atau `Suhu:` → Suhu Tubuh (30°C - 45°C).
  - `Vitamin K 10 mg` vs `Kalium` (cegah *false hyperkalemia alarm*).
  - `CR: 2 detik` (*Capillary Refill Time*) vs `Kreatinin`.
  - **Anti-Date Guard**: Jangan sampai tanggal (misal `3/10/26`) tertangkap sebagai angka lab gula darah (`GDS = 3`).
  - Pemisah ribuan format Indonesia (misal `1.050.000 /uL` trombosit).
- Lokasi berkas: [`src/services/clinical/internalMedicineEngine.ts`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/internalMedicineEngine.ts) dan [`src/services/clinical/croge.ts`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/croge.ts).

### 3. Kalkulator Klinis & Pre-Operative Risk Assessment
- Memperluas kalkulator risiko perioperatif:
  - **RCRI (Revised Cardiac Risk Index - Lee)**
  - **ARISCAT Score** (Risiko komplikasi paru pasca-operasi)
  - **Caprini Risk Score** / **Padua Prediction Score** (Risiko VTE/DVT)
  - **IMPROVE Bleeding Risk Score**
- Lokasi berkas: [`src/services/clinical/protocols/scoringCalculators.ts`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/protocols/scoringCalculators.ts).

### 4. Standar Interoperabilitas Medis (FHIR R4, SNOMED, LOINC, RxNorm)
- Menambah pemetaan terminologi medis ke SNOMED CT, LOINC, dan RxNorm.
- Memastikan ekspor FHIR R4 Bundle valid dan mematuhi spesifikasi standar HL7 FHIR.
- Lokasi berkas: [`src/services/fhir/`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/fhir/), [`src/services/loinc/`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/loinc/), dan kamus terminologi di [`src/services/clinical/`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/src/services/clinical/).

### 5. UI/UX Side Panel & Aksesibilitas
- Mempercantik antarmuka React 18 / Tailwind CSS dengan tema visual *Deep Maroon* (`#4A151B`) dan *Warm Gold* (`#CDA258`).
- Meningkatkan ergonomi input klinisi (keyboard shortcut, copy-to-clipboard cepat, export PDF/Markdown).

---

## 🔒 3 Prinsip Utama (Non-Negotiable Invariants)

Setiap kontribusi wajib mematuhi 3 aturan mutlak berikut:

1. **Zero Data Egress / 100% On-Device Execution**:
   - Seluruh parsing, inferensi, kalkulasi skor, ekstraksi entitas, dan de-identifikasi HARUS berjalan secara lokal di perangkat peramban pengguna (via WASM, WebGPU, regex, atau deterministic engine).
   - DILARANG mengintegrasikan API cloud eksternal yang mengirimkan teks pasien tanpa enkripsi atau de-identifikasi penuh dan izin eksplisit dari pengguna.
2. **Clinician-in-the-Loop Philosophy**:
   - internize.ai bertindak sebagai *clinical highlighter* dan *scaffolding assistant*.
   - Output sistem harus selalu dapat diedit oleh DPJP dan tidak pernah mengklaim menggantikan pertimbangan klinis dokter.
3. **Clinical Safety & Anti-Hallucination Guardrails**:
   - Jika tanda vital tidak tercatat di teks sumber (misal tekanan darah tidak ada), sistem DILARANG membuat klaim halusinasi seperti "tekanan darah sangat rendah".

---

## 🛠️ Langkah Menyiapkan Environment Pengembangan

### Prasyarat
- **Node.js** versi `>= 18.0.0` (disarankan LTS v20.x)
- **npm** (atau `pnpm` / `yarn`)
- **Google Chrome** (versi 116 ke atas dengan dukungan Side Panel)

### Setup Proyek

```bash
# 1. Fork repositori ini di GitHub
# 2. Clone repositori hasil fork ke komputer lokal
git clone https://github.com/<username-anda>/internize.ai.git
cd internize.ai

# 3. Buat branch baru untuk fitur atau perbaikan Anda
git checkout -b feat/tambah-protokol-hepatitis-b

# 4. Install dependensi
npm install

# 5. Jalankan development server dengan Hot Module Replacement (HMR)
npm run dev
```

### Menjalankan Extension di Chrome
1. Buka `chrome://extensions` di Google Chrome.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked** di pojok kiri atas.
4. Pilih folder `dist/` dari proyek internize.ai (jalankan `npm run build` atau biarkan `npm run dev` meng-compile).
5. Buka sembarang tab website EMR atau teks klinis, klik ikon internize.ai di toolbar, dan Side Panel akan terbuka.

---

## 🧪 Pengujian & Kualitas Kode

Sebelum mengajukan Pull Request, pastikan seluruh pengujian berhasil dijalankan tanpa error:

```bash
# Menjalankan pemeriksaan tipe data TypeScript
npx tsc --noEmit

# Menjalankan linter Biome
npm run lint

# Menjalankan seluruh test suite (Unit Tests + E2E Acceptance Tests)
npm test

# Menjalankan hanya unit tests
npm run test:unit

# Menjalankan verifikasi build produksi
npm run build
```

Jika Anda menambahkan fitur atau modul parsing baru, **wajib menyertakan unit test** di folder [`tests/unit/`](file:///c:/Users/Wib%20PC/Documents/Project/myproject/internize.ai/tests/unit/).

---

## 🚀 Alur Pengajuan Pull Request (PR)

1. **Commit Perubahan Anda**:
   Gunakan pesan commit yang deskriptif mengikuti konvensi conventional commits:
   - `feat: ...` untuk fitur atau protokol baru
   - `fix: ...` untuk perbaikan bug parsing atau kalkulator
   - `docs: ...` untuk perbaikan dokumentasi
   - `test: ...` untuk penambahan test case klinis
   - `refactor: ...` untuk refactoring kode tanpa mengubah fungsionalitas

   ```bash
   git add .
   git commit -m "feat: tambahkan protokol tatalaksana krisis tiroid"
   ```

2. **Push ke GitHub**:
   ```bash
   git push origin feat/tambah-protokol-hepatitis-b
   ```

3. **Buka Pull Request**:
   - Buka repositori `indra-dot/internize.ai` di GitHub.
   - Klik **Compare & pull request**.
   - Berikan penjelasan singkat mengenai perubahan Anda, referensi konsensus atau pedoman klinis PAPDI yang digunakan (jika relevan), dan lampirkan screenshot jika terdapat perubahan UI.

---

## 💬 Diskusi & Bantuan

Punya pertanyaan atau ide fitur klinis baru?
- Buka diskusi di [GitHub Issues](https://github.com/indra-dot/internize.ai/issues).
- Diskusikan skenario klinis atau usulkan shorthand baru yang sering Anda temui saat bertugas di RS.

Salam Sejawat & Selamat Berkontribusi! 🇮🇩👨‍⚕️👩‍⚕️
