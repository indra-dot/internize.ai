# Blueprint Google Sites — internize.ai (Sp.PD)
*Dokumen Panduan Layout, Copywriting Klinis, dan Struktur Visual Situs Resmi internize.ai*

---

## 1. Identitas Visual & Desain Sistem

- **Palet Warna Utama**:
  - **Deep Maroon / Burgundy**: `#4A151B` (Primary Background / Hero), `#581C24` (Hover / Card Borders)
  - **Warm Gold**: `#CDA258` (Accent Gold / CTAs), `#B88942` (Dark Gold Borders)
  - **Slate Neutral**: `#0F172A` (Text Primary), `#475569` (Text Secondary), `#F8FAFC` (Canvas Background)
  - **Clinical Emerald**: `#059669` (On-Device & Zero Egress Badge), `#ECFDF5` (Safe Background)
- **Tipografi Rekomendasi Google Sites**:
  - Header: *Merriweather* / *Playfair Display* / *Inter (Bold)*
  - Body: *Inter* / *Open Sans* (Ukuran 15px - 16px, line-height 1.6)
- **Logo & Favicon**:
  - Geometric Gold Shield dengan inisial `i` beraura maroon (`/icons/icon128.png`).

---

## 2. Navigasi & Struktur Halaman (Sitemap)

1. **Beranda (Home)**: Hero banner, 3 Tombol Aksi Utama (CTA), ikhtisar nilai klinis, arsitektur on-device zero egress.
2. **3 Mode Alur Sp.PD**: Jawab Konsul TS, Periksa Pasien (POMR 4P), Ringkas Kasus.
3. **121 PPK & Subspesialisasi**: Cakupan 11 divisi PAPDI dan guardrail klinis Indonesia.
4. **Keamanan & Privasi PHI**: Edukasi on-device AI, kepatuhan UU PDP, dan perlindungan data rekam medis.
5. **Panduan Instalasi Ekstensi**: Tutorial visual 3 langkah pasang di Chrome / Microsoft Edge.

---

## 3. Komponen Utama: 3 Call-To-Action (CTA)

Tempatkan tombol-tombol ini secara menonjol di **Hero Section** dan di **Sticky Footer** situs:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  [Tombol 1 - Primary Gold]                                            │
│  🚀 BUKA WEB APP LANGSUNG                                              │
│  Tautan: https://internize-ai.vercel.app                               │
│  Deskripsi: Siap pakai di peramban tanpa instalasi atau registrasi     │
├────────────────────────────────────────────────────────────────────────┤
│  [Tombol 2 - Solid Maroon / Border Gold]                              │
│  📦 DOWNLOAD EKSTENSI CHROME (.ZIP)                                    │
│  Tautan: https://internize-ai.vercel.app/internize-ai-extension.zip    │
│  Deskripsi: Panel samping cerdas pendamping EHR/SIMRS saat visite      │
├────────────────────────────────────────────────────────────────────────┤
│  [Tombol 3 - Outline Neutral]                                         │
│  📖 PANDUAN FITUR & INSTALASI                                          │
│  Tautan: #panduan-instalasi                                            │
│  Deskripsi: Tutorial 3 langkah mudah pasang di Chrome & Microsoft Edge │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Materi Copywriting Klinis Per Seksi (Bahasa Indonesia)

### Seksi 1: Hero Section

- **Badge Atas**: `🔒 100% On-Device • Sesuai Panduan PAPDI • Tanpa Egress PHI`
- **Judul Utama**:
  > **Asisten Klinis Cerdas Dokter Spesialis & Residen Penyakit Dalam Indonesia**
- **Sub-judul**:
  > *"Susun telaah konsul TS, asesmen POMR 4P berbasis 121 PPK PAPDI, dan ringkasan kasus rawat inap dalam hitungan detik. Berjalan seutuhnya di peramban Anda — data medis pasien tidak pernah keluar dari perangkat."*
- **Aksi Cepat**:
  - `[Buka Web App]` (Menuju deployment Vercel)
  - `[Download Ekstensi Chrome]` (Download file ZIP instan)
  - `[Panduan Pemasangan]` (Scroll ke seksi tutorial)

---

### Seksi 2: Tiga Mode Alur Kerja Utama Sp.PD

#### Mode 1: Jawab Konsul Teman Sejawat (TS)
- **Fokus**: Menjawab permintaan konsultasi dari bagian bedah, obgyn, saraf, atau unit lain dengan cepat, presisi, dan terstruktur.
- **Preset Klinis Unggulan**:
  1. **Pre-Operative Clearance**:
     - Skoring otomatis Lee Revised Cardiac Risk Index (RCRI) dan risiko pulmoner ARISCAT.
     - Telaah risiko kardiovaskular, stratifikasi toleransi operasi, serta rekomendasi perioperatif (manajemen OHO/insulin, antihipertensi, dan penundaan/bridging antikoagulan).
     - Format ringkas & jelas untuk lembar jawaban konsul status bedah.
  2. **Rawat Bersama (Co-Management)**:
     - Pembagian ranah terapi spesifik penyakit dalam pada kasus multi-morbiditas.
  3. **Evaluasi Akut CITO**:
     - Rekomendasi penanganan kegawatdaruratan penyakit dalam (krisis hiperglikemia DKA/HHS, krisis tiroid, syok sepsis, hiperkalemia berat).

#### Mode 2: Periksa Pasien (POMR 4P)
- **Fokus**: Visite harian terstandar Problem Oriented Medical Record (POMR).
- **Struktur 4P Lengkap**:
  - **Pdx (Planning Diagnostik)**: Usulan laboratorium lanjutan, biomarker serologi, mikrobiologi/kultur, dan radiologi terarah.
  - **Ptx (Planning Terapi)**: Regimen medikamentosa lini pertama sesuai konsensus PAPDI terkini, titrasi dosis cairan, dan penyesuaian fungsi ginjal (renal dose adjustment).
  - **Pmx (Planning Monitoring)**: Parameter tanda vital kritis, elektrolit serial, balans cairan per jam, dan target klinis.
  - **Pex (Planning Edukasi)**: Edukasi diet medis, restriksi cairan, modifikasi gaya hidup, serta tanda bahaya (*red flags*) untuk pasien dan keluarga.

#### Mode 3: Ringkas Kasus (Discharge & Handoff)
- **Fokus**: Pembuatan resume medis keluar rumah sakit dan operan jaga (handoff) shift ruangan/ICU.
- **Fitur Otomatis**:
  - Rekap kronologis masalah aktif.
  - Kompilasi riwayat penyakit dahulu (RPD) & riwayat pengobatan rawat jalan (RPO).
  - Deteksi dan peringatan nilai kritis laboratorium secara instan (*critical lab highlights*).

---

### Seksi 3: Cakupan 11 Subspesialisasi & 121 PPK PAPDI

internize.ai mengintegrasikan taksonomi penalaran dan knowledge base dari 11 organ subspesialisasi PAPDI:

1. **Endokrin-Metabolik-Diabetes**: DM Tipe 2 regulasi insulin, DKA, HHS, krisis tiroid (Burch-Wartofsky score), hipoglikemia, dislipidemia.
2. **Ginjal-Hipertensi**: AKI (KDIGO staging), CKD stage 1–5, sindroma nefrotik, penyesuaian dosis obat berbasis klirens kreatinin (Cockcroft-Gault).
3. **Tropik-Infeksi**: Sepsis (qSOFA / SOFA), Dengue Shock Syndrome, Demam Tifoid komplikasi, Malaria, Tuberkulosis (TB-RO & TB-SO), HIV/AIDS & infeksi oportunistik.
4. **Kardiologi**: Gagal jantung akut/kronik (NYHA & AHA/ACC), sindroma koroner akut (NSTEMI/STEMI/UAP), hipertensi emergensi/urgensi, aritmia umum.
5. **Pulmonologi**: PPOK eksaserbasi akut, Pneumonia Komunitas (CAP / CURB-65), Asma bronkiale eksaserbasi, Efusi pleura.
6. **Gastroenterohepatologi**: Perdarahan saluran cerna atas/bawah (Rockall / Blatchford score), Sirosis hepatis dekompensata (Child-Pugh), Pankreatitis akut, Diare kronis.
7. **Hematologi-Onkologi Medik**: Anemia defisiensi vs hemolitik vs penyakit kronis, DVT/VTE (Caprini score), Trombositopenia, Staging TNM onkologi solid (cTNM konversi stadium).
8. **Reumatologi**: Lupus Eritematosus Sistemik (SLE), Artritis Gout akut & kronis, Artritis Reumatoid (RA), Osteoartritis.
9. **Alergi-Imunologi**: Anafilaksis, Urtikaria kronis, Drug Eruption (SJS/TEN alert).
10. **Geriatri**: Sindroma geriatri, asesmen multimorbiditas, skor delirium, frailty index, polifarmasi.
11. **Psikosomatik**: Dispepsia fungsional, sindroma hiperventilasi, gangguan somatoform pada penyakit kronis.

---

### Seksi 4: Guardrail Klinis Bahasa & Singkatan Medis Indonesia

internize.ai dibangun secara spesifik memahami dialek dan singkatan penulisan dokter Indonesia:
- **Disambiguasi Vital Signs**: `T: 120/80` diterjemahkan sebagai Tensi / Tekanan Darah (bukan Temperatur).
- **Anti-Tabrakan Farmasi & Lab**:
  - Mencegah `Vitamin K 10 mg` disalahartikan sebagai Kalium (K) serum.
  - Mencegah `CR: 2 detik` (Capillary Refill Time) disalahartikan sebagai Kreatinin serum.
- **Serial Gula Darah Dinamis**: Mendeteksi `BS acak pk 13.35 WITA: 132` atau `GDA jam 14.00: 150` dan merangkumnya menjadi poin tren pemantauan glukosa.
- **Format Ribuan Indonesia**: Mengurai angka multi-titik seperti `Trombosit 1.050.000 /uL` dengan presisi tanpa terpotong titik desimal.

---

### Seksi 5: Standar Keamanan Data: 100% On-Device & Zero Egress

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PRINSIP ZERO EGRESS                             │
│                                                                        │
│   [Data Pasien di EHR]                                                 │
│            │                                                           │
│            ▼ (Copy-Paste Lokal ke Browser)                             │
│   [Browser WebGPU / WASM / Offline Rules] ◄─── TIDAK ADA SERVER LUAR   │
│            │                                                           │
│            ▼                                                           │
│   [Draf Rekomendasi Klinis] ──► (Disalin Kembali ke EHR oleh Dokter)   │
└────────────────────────────────────────────────────────────────────────┘
```

- **Tanpa Database Pasien di Cloud**: Tidak ada server penyimpanan rekam medis pasien di backend eksternal.
- **Kepatuhan UU PDP (No. 27/2022) & HIPAA Safe Harbor**: 18 kategori data pengenal medis terlindungi seutuhnya di memori peramban pengguna.
- **Mode BYOK (Bring Your Own Key)**: Jika dokter memilih mengaktifkan model generative AI Google Gemini, tokenisasi anonimisasi ([PATIENT_1], [MRN_1]) dijalankan secara lokal terlebih dahulu dengan parameter `store: false`.

---

### Seksi 6: Panduan Pemasangan Ekstensi Chrome 3 Langkah

Salin konten ini untuk seksi tutorial instalasi di Google Sites:

#### Langkah 1: Unduh & Ekstrak Paket Ekstensi
1. Unduh paket file: **`internize-ai-extension.zip`** melalui tombol unduh resmi.
2. Klik kanan file ZIP hasil unduhan, pilih **"Extract All..."** (Ekstrak Semua).
3. Simpan di folder komputer yang mudah diakses (contoh: `C:\internize-ai-extension`).

#### Langkah 2: Buka Pengaturan Ekstensi Browser
1. Buka Google Chrome atau Microsoft Edge.
2. Ketik alamat berikut di bilah URL: `chrome://extensions/` *(atau `edge://extensions/` di Edge)*.
3. Di pojok kanan atas, nyalakan saklar **"Mode pengembang" (Developer mode)**.

#### Langkah 3: Muat Ekstensi
1. Klik tombol **"Muat yang belum dibongkar" (Load unpacked)** di pojok kiri atas.
2. Pilih folder hasil ekstrak dari Langkah 1.
3. **Selesai!** Ekstensi internize.ai langsung aktif dan siap digunakan berdampingan dengan rekam medis elektronik Anda.

---

## 5. Pertanyaan Umum (FAQ)

**Q: Apakah internize.ai berbayar atau memerlukan langganan bulanan?**  
A: Tidak. internize.ai bersifat gratis dan non-komersial untuk mendukung dokter spesialis penyakit dalam, PPDS Sp.PD, dan tenaga kesehatan di seluruh Indonesia.

**Q: Apakah aplikasi ini dapat bekerja jika internet rumah sakit mati?**  
A: Ya! Mesin inferensi utama (CROGE rule-engine, ekstraksi lab, validasi PPK, dan kalkulator medis) bekerja 100% offline di browser Anda tanpa perlu akses internet.

**Q: Apakah aman digunakan pada rekam medis elektronik rumah sakit?**  
A: Sangat aman. Arsitektur Zero Egress menjamin tidak ada rekaman teks atau identitas pasien yang dikirim keluar dari memori lokal komputer Anda.

---

## 6. Checklist Peluncuran Google Sites

- [ ] Masukkan URL Web App Vercel: `https://internize-ai.vercel.app` (atau domain kustom).
- [ ] Masukkan Tautan Download ZIP: `https://internize-ai.vercel.app/internize-ai-extension.zip`.
- [ ] Tambahkan Logo Gold Shield di Header dan Favicon.
- [ ] Sisipkan screenshot 3 Mode Klinis (Jawab Konsul, POMR 4P, Ringkas Kasus).
- [ ] Konfigurasikan Metadata SEO:
  - *Title*: `internize.ai — Asisten Klinis Sp.PD Indonesia On-Device`
  - *Description*: `Platform asisten visite, konsul TS, dan POMR 4P berbasis 121 PPK PAPDI dengan keamanan on-device zero egress.`
