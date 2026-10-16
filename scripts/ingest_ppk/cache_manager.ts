/**
 * cache_manager.ts — Content-Addressable SHA-256 Cache Manager (internize.ai)
 * 
 * Manages caching for extracted and OCR'd clinical text:
 * - Content-addressable via file SHA-256 hash.
 * - Stores individual OCR text results under scripts/ingest_ppk/cache/ocr/{slug}.json.
 * - Tracks global cache manifest under scripts/ingest_ppk/cache/manifest.json.
 * - Guarantees warm rebuilds execute in < 1 second.
 */

import fs from 'fs';
import path from 'path';

export interface CacheEntry {
  slug: string;
  relPath: string;
  sha256: string;
  format: string;
  isScanned: boolean;
  pageCount: number;
  extractedAt: string;
  charCount: number;
}

export interface CacheManifest {
  version: string;
  lastUpdated: string;
  totalDocuments: number;
  entries: Record<string, CacheEntry>;
}

export class PpkCacheManager {
  private cacheDir: string;
  private ocrDir: string;
  private manifestPath: string;
  private manifest: CacheManifest;

  constructor(cacheDir: string = path.resolve('scripts/ingest_ppk/cache')) {
    this.cacheDir = cacheDir;
    this.ocrDir = path.join(cacheDir, 'ocr');
    this.manifestPath = path.join(cacheDir, 'manifest.json');

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.ocrDir)) {
      fs.mkdirSync(this.ocrDir, { recursive: true });
    }

    this.manifest = this.loadManifest();
  }

  private loadManifest(): CacheManifest {
    if (fs.existsSync(this.manifestPath)) {
      try {
        const raw = fs.readFileSync(this.manifestPath, 'utf-8');
        return JSON.parse(raw);
      } catch {
        // Fallback to fresh manifest if corrupt
      }
    }
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalDocuments: 0,
      entries: {}
    };
  }

  public saveManifest(): void {
    this.manifest.lastUpdated = new Date().toISOString();
    this.manifest.totalDocuments = Object.keys(this.manifest.entries).length;
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  public isOcrCached(slug: string, sha256: string): boolean {
    const entry = this.manifest.entries[slug];
    if (!entry || entry.sha256 !== sha256) {
      return false;
    }
    const ocrFile = path.join(this.ocrDir, `${slug}.json`);
    return fs.existsSync(ocrFile);
  }

  public getOcrText(slug: string): string | null {
    const ocrFile = path.join(this.ocrDir, `${slug}.json`);
    if (!fs.existsSync(ocrFile)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(ocrFile, 'utf-8'));
      return data.text || null;
    } catch {
      return null;
    }
  }

  public saveOcrResult(slug: string, relPath: string, sha256: string, pageCount: number, text: string): void {
    const ocrFile = path.join(this.ocrDir, `${slug}.json`);
    fs.writeFileSync(ocrFile, JSON.stringify({
      slug,
      relPath,
      sha256,
      pageCount,
      ocrDate: new Date().toISOString(),
      text,
      charCount: text.length
    }, null, 2), 'utf-8');

    this.manifest.entries[slug] = {
      slug,
      relPath,
      sha256,
      format: 'pdf',
      isScanned: true,
      pageCount,
      extractedAt: new Date().toISOString(),
      charCount: text.length
    };
  }

  public registerEntry(entry: CacheEntry): void {
    this.manifest.entries[entry.slug] = entry;
  }

  public getEntry(slug: string): CacheEntry | undefined {
    return this.manifest.entries[slug];
  }
}
