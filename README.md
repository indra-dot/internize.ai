# internize.ai

<div align="center">
  <img src="src/assets/logo.png" alt="internize.ai logo" width="100" />
  <h3>Asisten AI Klinis Spesialis Penyakit Dalam (Sp.PD) & Penelitian Medis</h3>
  <p><strong>100% On-Device Privacy • Zero Egress • Clinical Shorthand Parser • FHIR R4 • HIPAA Safe Harbor</strong></p>
</div>

---

## 🩺 Mengenai internize.ai

**internize.ai** adalah Chrome Extension (Manifest V3) yang dirancang khusus untuk memfasilitasi alur kerja klinisi dan dokter spesialis penyakit dalam (Sp.PD) di Indonesia serta penelitian kedokteran. 

Sistem ini beroperasi dengan prinsip **Clinician-in-the-Loop** dan **Zero Data Egress Invariant**:
- 🔒 **100% On-Device**: Seluruh ekstraksi entitas, parsing teks klinis, deteksi laboratorium, dan de-identifikasi diproses secara lokal di browser via WebGPU / WASM (Transformers.js v3) atau aturan CROGE/deterministic. 
- 🚫 **Tanpa API LLM Eksternal**: Data pasien (Protected Health Information / PHI) tidak pernah dikirim ke server AI publik pihak ketiga mana pun.

---

## ✨ Fitur Unggulan

### 1. 📋 Layanan Klinis & Alur Kerja Sp.PD (3 Core Modes)
- **Jawab Konsul TS**: Preset asesmen cepat untuk:
  - *Pre-Operative Clearance* (Skor Risiko Kardiak RCRI Lee, advis gula darah, tensi, antikoagulan, status kelaikan operasi).
  - *Rawat Bersama*.
  - *Evaluasi Akut CITO*.
- **Periksa Pasien (POMR)**: Standarisasi Problem Oriented Medical Record berbasis 11 sub-spesialisasi organ PAPDI dengan rincian Pdx (Diagnostik), Ptx (Terapi), Pmx (Monitoring), dan Pex (Edukasi).
- **Ringkas Kasus**: Rangkuman kronologis problem aktif, riwayat penyakit terdahulu (RPD), riwayat pengobatan (RPO), dan sorotan abnormalitas lab.

### 2. 🇮🇩 Engine Parsing Singkatan Klinis Indonesia
- **Vital Signs Disambiguation**: Mengenali format shorthand lokal seperti `T:` / `TD:` (Tensi/Tekanan Darah, bukan temperatur), `N:` (Nadi), `R:` / `RR:` (Respirasi), `S:` / `Suhu:` (Suhu tubuh).
- **Collision Prevention**:
  - `Vitamin K 10 mg` vs `Kalium` (mencegah alarm palsu hiperkalemia).
  - `CR: 2 detik` (Capillary Refill Time) vs `Kreatinin`.
  - Format angka ribuan Indonesia (contoh: `1.050.000 /uL` atau `250.000 /uL`).
- **Target Marker Kritis Sp.PD**: Deteksi dan ambang batas otomatis untuk `HbA1c`, `Laktat`, `Trombosit`, `Kalium`, `Natrium`, `Ureum`, `Kreatinin`, dan `Troponin`.

### 3. 🔬 Riset & De-Identifikasi HIPAA Safe Harbor
- **18 Kategori HIPAA Safe Harbor**: Redaksi otomatis nama pasien, NIK/MRN, nomor telepon Indonesia, tanggal lahir, alamat, dsb.
- **Standar Interoperabilitas**:
  - Pemetaan diagnostik ke **SNOMED CT** (dengan deteksi negasi NegEx).
  - Rekonsiliasi medikasi ke **RxNorm** (RxCUI, dosis, rute, frekuensi).
  - Ekstraksi biomarker laboratorium ke **LOINC** dengan unit UCUM.
  - Export data ke dalam format **FHIR R4 Bundle** (`transaction`) siap pakai.
- **Sinkronisasi Opsional**: Ekspor bundle hasil de-identifikasi ke Supabase database penelitian pribadi (opsional).

---

## 🚀 Panduan Instalasi (Untuk Rekan Sejawat / Tester)

Bagi rekan dokter yang ingin mencoba extension ini di Google Chrome komputer/laptop:

### Langkah 1: Siapkan File Extension
1. Download file ZIP release yang diberikan oleh tim pengembang, lalu **Extract** file tersebut di komputer Anda (misalnya di folder `internize-ai-dist`).
2. Pastikan di dalam folder tersebut terdapat file `manifest.json` dan folder `assets/`.

### Langkah 2: Pasang di Google Chrome
1. Buka browser **Google Chrome**.
2. Masukkan alamat berikut di address bar:
   ```text
   chrome://extensions
   ```
3. Di pojok kanan atas, aktifkan tombol **"Developer mode"** (Mode Pengembang).
4. Klik tombol **"Load unpacked"** (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder hasil ekstrak tadi (`dist` atau folder rilis).
6. Selesai! Ikon **internize.ai** akan muncul di toolbar Chrome Anda.

### Langkah 3: Menggunakan Extension
1. Klik ikon pin pada extension internize.ai di toolbar Chrome agar selalu terlihat.
2. Klik ikon internize.ai untuk membuka **Side Panel** di sisi kanan browser.
3. Anda dapat langsung mengetik, menempel resume medik, atau menyorot teks pada rekam medis elektronik (EMR) web untuk dianalisis otomatis secara lokal.

---

## 💻 Panduan Developer & Kontribusi

### Prasyarat
- **Node.js** >= 18.x
- **npm** atau **pnpm**
- **Google Chrome** >= 116 (mendukung Manifest V3 Side Panel & WebGPU)

### Setup & Build Lokal

```powershell
# 1. Clone repositori
git clone https://github.com/indra-dot/internize.ai.git
cd internize.ai

# 2. Install dependensi
npm install

# 3. Jalankan type-check TypeScript
npx tsc --noEmit

# 4. Jalankan linter
npm run lint

# 5. Jalankan unit test & test E2E klinis
npm test

# 6. Build production output (menghasilkan folder dist/)
npm run build
```

Setelah `npm run build` selesai, Anda dapat memuat folder `dist/` ke `chrome://extensions` via **Load unpacked**.

---

## 📁 Struktur Repositori

```text
internize.ai/
├── manifest.json              # Chrome Manifest V3 configuration
├── sidepanel.html             # Entry point tampilan side panel
├── src/
│   ├── background/            # Service worker (lifecycle & IPC routing)
│   ├── content/               # Content script penangkap highlight seleksi teks
│   ├── sidepanel/             # Antarmuka React 18 & navigation shell
│   ├── components/            # UI components (Header, Card, Modal, Button, Badge)
│   ├── features/
│   │   ├── clinical/          # Workflow Sp.PD, POMR, SOAP viewer, SNOMED, RxNorm
│   │   ├── research/          # HIPAA De-identification, LOINC extraction, FHIR Bundle
│   │   └── settings/          # Konfigurasi sync Supabase lokal
│   ├── services/
│   │   ├── clinical/          # Engine CROGE, protokol PAPDI, scoring & kalkulator
│   │   ├── deid/              # De-identifier HIPAA Safe Harbor & validasi
│   │   ├── loinc/             # Ekstraksi biomarker LOINC & kamus lab
│   │   ├── fhir/              # FHIR R4 Bundle assembler & exporter
│   │   └── storage/           # Wrapper chrome.storage lokal & sinkronisasi
│   └── types/                 # Definisi tipe data TypeScript
└── tests/
    ├── unit/                  # Unit testing klinis & kalkulator Sp.PD
    └── e2e/                   # E2E acceptance test suite
```

---

## 🛡️ Kebijakan Privasi & Kepatuhan Etika Medis

- **Zero Egress**: Tidak ada pengiriman data teks rekam medis ke server pihak ketiga manapun. Komputasi AI berjalan di memori lokal peramban.
- **Bantuan Pendamping (Scaffolding Assistant)**: Sistem ini adalah alat bantu kognitif dan struktur administratif klinis. Keputusan diagnosis akhir dan terapi medis tetap sepenuhnya berada di tangan dokter penanggung jawab pelayanan (DPJP).

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
