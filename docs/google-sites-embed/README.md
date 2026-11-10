# Cara Memasang Widget internize.ai di Google Sites

Ada 2 cara praktis untuk memasang portal **internize.ai** ke Google Sites Anda:

---

## Cara 1: Langsung Tempel Kode HTML (Paling Cepat & Direkomendasikan ⚡)

Tanpa perlu setup Google Apps Script, Anda bisa langsung menyematkan kode HTML interaktif:

1. Buka [Google Sites](https://sites.google.com/) dan buka situs Anda dalam mode edit.
2. Di panel kanan, klik tab **Sisipkan (Insert)** > pilih **Sematkan (Embed)**.
3. Pada jendela yang muncul, pilih tab **Sematkan kode (Embed code)**.
4. Buka file [`docs/google-sites-embed/embed-code.html`](./embed-code.html), salin (copy) seluruh kodenya, dan tempelkan (paste) ke kotak tersebut.
5. Klik **Berikutnya (Next)**, lalu klik **Sisipkan (Insert)**.
6. Atur lebar dan tinggi kotak widget agar pas dan elegan di halaman situs Anda.
7. Klik **Publikasikan (Publish)**. Selesai!

Widget ini sudah dilengkapi:
- ✅ Tombol **🚀 Buka Web App** mengarah ke `https://internizeai.vercel.app`
- ✅ Tombol **📦 Unduh Ekstensi** langsung mengunduh file `internize-ai-extension.zip` dari Vercel
- ✅ Indikator versi otomatis tersinkronisasi via `https://internizeai.vercel.app/version.json`
- ✅ Accordion panduan 3 langkah pemasangan ekstensi
- ✅ Tema warna resmi Sp.PD: *Deep Maroon (`#4A151B`)* dan *Warm Gold (`#CDA258`)*

---

## Cara 2: Menggunakan Google Apps Script (Opsional)

Jika Anda ingin mengelolanya sebagai Google Apps Script Web App:

1. Buka [script.google.com](https://script.google.com/) dan buat **Proyek Baru**.
2. Salin kode dari file [`docs/google-sites-embed/Code.gs`](./Code.gs) dan gantikan isi `Code.gs`.
3. Klik tombol **Deploy (Terapkan)** di kanan atas > pilih **New deployment (Penerapan baru)**.
4. Pilih roda gigi jenis penerapan > pilih **Web app (Aplikasi web)**.
5. Pada bagian **Who has access (Siapa yang memiliki akses)**, ubah menjadi **Anyone (Siapa saja)**.
6. Klik **Deploy** dan salin URL Web App yang dihasilkan.
7. Di Google Sites: **Sisipkan** > **Sematkan** > **Berdasarkan URL** > tempel URL tersebut.
