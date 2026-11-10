/**
 * Google Apps Script untuk internize.ai Portal Embed
 * 
 * Cara Penggunaan:
 * 1. Buka https://script.google.com/ lalu klik "Proyek Baru" (New Project).
 * 2. Hapus isi Code.gs dan ganti dengan script ini.
 * 3. Klik menu "Deploy" (Terapkan) -> "New deployment" (Penerapan baru).
 * 4. Pilih tipe "Web app" (Aplikasi web).
 * 5. Set "Who has access" (Siapa yang memiliki akses) ke "Anyone" (Siapa saja).
 * 6. Klik Deploy dan salin URL Web App yang dihasilkan.
 * 7. Di Google Sites: Sisipkan (Insert) -> Sematkan (Embed) -> Berdasarkan URL -> Tempel URL Web App tersebut.
 */

function doGet() {
  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>internize.ai Portal</title>
  <style>
    :root {
      --maroon-dark: #380d12;
      --maroon-base: #4A151B;
      --gold-base: #CDA258;
      --gold-hover: #b88942;
      --gold-light: #e8d19e;
      --white: #ffffff;
      --emerald: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: transparent; color: #fff; display: flex; justify-content: center; padding: 12px; }
    .card { width: 100%; max-width: 680px; background: linear-gradient(145deg, #180608 0%, #260a0f 50%, #150508 100%); border: 1px solid rgba(205,162,88,0.35); border-radius: 18px; padding: 22px; box-shadow: 0 16px 36px rgba(0,0,0,0.45); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(205,162,88,0.2); padding-bottom: 14px; margin-bottom: 14px; }
    .brand { font-size: 20px; font-weight: 800; color: #fff; }
    .brand span { color: var(--gold-base); }
    .badge { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: rgba(205,162,88,0.15); border: 1px solid rgba(205,162,88,0.4); color: var(--gold-light); font-weight: 700; }
    .privacy { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #a7f3d0; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    @media(max-width:480px){.grid{grid-template-columns:1fr;}}
    .btn { display: flex; flex-direction: column; padding: 14px 16px; border-radius: 12px; text-decoration: none; cursor: pointer; transition: transform 0.2s; }
    .btn:hover { transform: translateY(-2px); }
    .btn-gold { background: linear-gradient(135deg, var(--gold-base), var(--gold-hover)); color: #1a080a; font-weight: 800; }
    .btn-maroon { background: rgba(74,21,27,0.6); border: 1px solid rgba(205,162,88,0.4); color: #fff; font-weight: 800; }
    .btn-sub { font-size: 11px; font-weight: 500; margin-top: 4px; opacity: 0.85; }
    .guide-box { background: rgba(255,255,255,0.04); border: 1px dashed rgba(205,162,88,0.3); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: var(--gold-light); cursor: pointer; }
    .guide-steps { display: none; margin-top: 10px; background: rgba(15,23,42,0.7); border-radius: 8px; padding: 12px; color: #cbd5e1; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">internize<span>.ai</span> — Clinical Cockpit Sp.PD</div>
      <div class="badge" id="vBadge">v2.2.0 (Live)</div>
    </div>
    <div class="privacy">
      🔒 <strong>100% On-Device & Zero Egress:</strong> Parsing rekam medis & inferensi AI dijalankan lokal di browser tanpa pengiriman data ke server luar.
    </div>
    <div class="grid">
      <a href="https://internizeai.vercel.app" target="_blank" class="btn btn-gold">
        <div>🚀 Buka Web App</div>
        <div class="btn-sub">Langsung akses di peramban</div>
      </a>
      <a href="https://internizeai.vercel.app/internize-ai-extension.zip" download="internize-ai-extension.zip" class="btn btn-maroon">
        <div>📦 Unduh Ekstensi Chrome</div>
        <div class="btn-sub">Paket siap pasang (.ZIP)</div>
      </a>
    </div>
    <div class="guide-box" onclick="toggle()">
      💡 Panduan 3 Langkah Pemasangan Ekstensi (Klik di sini)
      <div id="steps" class="guide-steps">
        1. Klik <strong>Unduh Ekstensi</strong> dan ekstrak file <code>internize-ai-extension.zip</code>.<br>
        2. Buka <code>chrome://extensions</code> di browser dan aktifkan <strong>Developer mode</strong>.<br>
        3. Klik <strong>Load unpacked</strong> dan pilih folder hasil ekstrak.
      </div>
    </div>
  </div>
  <script>
    function toggle() {
      var s = document.getElementById('steps');
      s.style.display = (s.style.display === 'block') ? 'none' : 'block';
    }
  </script>
</body>
</html>
  `;

  return HtmlService.createHtmlOutput(htmlContent)
    .setTitle("internize.ai Portal")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
