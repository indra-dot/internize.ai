import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const distExtensionDir = path.join(projectRoot, 'dist-extension');
const publicDir = path.join(projectRoot, 'public');
const distDir = path.join(projectRoot, 'dist');

export async function createZip(sourceDir: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destPath);
    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    output.on('close', () => {
      resolve(archive.pointer());
    });

    archive.on('warning', (err: { code?: string } & Error) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);
    // Exclude any nested zip files to prevent recursive archive inflation
    archive.directory(sourceDir, false, (entry) => {
      if (entry.name.endsWith('.zip')) {
        return false;
      }
      return entry;
    });
    archive.finalize();
  });
}

export async function packageAndVersion(): Promise<void> {
  console.log('📦 Starting internize.ai Chrome Extension packaging...');

  if (!fs.existsSync(distExtensionDir)) {
    throw new Error(
      `dist-extension directory does not exist at ${distExtensionDir}. Run 'npm run build:ext' first.`,
    );
  }

  // Clean any nested .zip files in dist-extension prior to packaging
  const distExtFiles = fs.readdirSync(distExtensionDir);
  for (const file of distExtFiles) {
    if (file.endsWith('.zip')) {
      try {
        fs.unlinkSync(path.join(distExtensionDir, file));
        console.log(`🧹 Removed nested zip: ${file}`);
      } catch {}
    }
  }

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Read version from package.json
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '2.2.0';
  const releaseDate = new Date().toISOString().split('T')[0];

  const versionPayload = {
    version,
    releaseDate,
    downloadUrl: '/internize-ai-extension.zip',
    minExtensionVersion: '2.0.0',
    changelog: [
      'Pembaruan ekosistem distribusi: Deployment Vercel & Chrome Extension instan tanpa GitHub 404',
      'In-app update checker dan panduan instalasi visual 3 langkah (InstallGuideModal)',
      'Peningkatan kompatibilitas WebGPU/WASM On-Device Zero Egress via COOP/COEP Vercel headers',
      'Integrasi 121 PPK Sp.PD & sinkronisasi otomatis status klinis offline-first',
    ],
  };

  // Write version.json to public/
  const publicVersionPath = path.join(publicDir, 'version.json');
  fs.writeFileSync(publicVersionPath, JSON.stringify(versionPayload, null, 2), 'utf8');
  console.log(`✅ Generated ${publicVersionPath} (v${version})`);

  // Package extension into public/internize-ai-extension.zip
  const publicZipPath = path.join(publicDir, 'internize-ai-extension.zip');
  const bytes = await createZip(distExtensionDir, publicZipPath);
  console.log(`✅ Generated ${publicZipPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);

  // Also copy/create at project root for test backwards compatibility (test_milestone5_version_packaging)
  const rootZipPath = path.join(projectRoot, 'internize-ai-extension.zip');
  fs.copyFileSync(publicZipPath, rootZipPath);
  console.log(`✅ Mirrored ${rootZipPath}`);

  // If dist/ already exists (e.g. if web build ran or re-running), mirror files to dist/
  if (fs.existsSync(distDir)) {
    const distZipPath = path.join(distDir, 'internize-ai-extension.zip');
    fs.copyFileSync(publicZipPath, distZipPath);
    const distVersionPath = path.join(distDir, 'version.json');
    fs.copyFileSync(publicVersionPath, distVersionPath);
    console.log(`✅ Synced into dist/ (${distZipPath}, ${distVersionPath})`);
  }

  console.log('🎉 Extension packaging complete.');
}

// Execute if run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  packageAndVersion().catch((err) => {
    console.error('❌ Packaging failed:', err);
    process.exit(1);
  });
}
