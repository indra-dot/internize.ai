# Cara Memasang Widget internize.ai di Google Sites

Ada 2 cara praktis untuk memasang portal **internize.ai** ke Google Sites Anda:

---

## ⚡ URL Web App Google Apps Script Aktif (Siap Pakai)

Jika Anda ingin langsung menyematkan URL tanpa mengedit kode:
```text
https://script.google.com/macros/s/AKfycbzt_iLfalvX8Csm3ULI5oxJPdswUoJ66zXVe8EdeBVcGYHXXe2lEzNCueUBIGIS2FLG/exec
```

**Langkah di Google Sites:**
1. Buka [Google Sites](https://sites.google.com/) editor Anda.
2. Di panel kanan, klik **Sisipkan (Insert)** > pilih **Sematkan (Embed)**.
3. Pilih opsi **Berdasarkan URL (By URL)**.
4. Tempelkan URL di atas, pilih opsi **Seluruh halaman / Pratinjau**, lalu klik **Sisipkan (Insert)**.
5. Atur ukuran kotak widget agar pas dan elegan. Selesai!

---

## Cara Alternatif 1: Langsung Tempel Kode HTML (Custom Embed Code)

Jika ingin kontrol visual 100% langsung di dalam Google Sites:
1. Di panel kanan Google Sites, klik tab **Sisipkan (Insert)** > pilih **Sematkan (Embed)**.
2. Pilih tab **Sematkan kode (Embed code)**.
3. Buka file [`docs/google-sites-embed/embed-code.html`](./embed-code.html), salin seluruh kodenya, dan tempelkan ke kotak tersebut.
4. Klik **Berikutnya (Next)** > **Sisipkan (Insert)**.

Widget ini sudah dilengkapi:
- ✅ Tombol **🚀 Buka Web App** mengarah ke `https://internizeai.vercel.app`
- ✅ Tombol **📦 Unduh Ekstensi** langsung mengunduh file `internize-ai-extension.zip` dari Vercel
- ✅ Indikator versi otomatis tersinkronisasi via `https://internizeai.vercel.app/version.json`
- ✅ Accordion panduan 3 langkah pemasangan ekstensi
- ✅ Tema warna resmi Sp.PD: *Deep Maroon (`#4A151B`)* dan *Warm Gold (`#CDA258`)*

---

## Cara Alternatif 2: Deploy Mandiri Google Apps Script

Jika ingin menduplikasi script ke akun Google Workspace institusi rumah sakit:
1. Buka [script.google.com](https://script.google.com/) dan buat **Proyek Baru**.
2. Salin kode dari file [`docs/google-sites-embed/Code.gs`](./Code.gs) dan gantikan isi `Code.gs`.
3. Klik tombol **Deploy (Terapkan)** di kanan atas > pilih **New deployment (Penerapan baru)**.
4. Pilih tipe **Web app (Aplikasi web)**, set akses ke **Anyone (Siapa saja)**.
5. Klik **Deploy** dan salin URL Web App yang dihasilkan.
