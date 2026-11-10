import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallGuideModal } from '../../src/components/ui/InstallGuideModal';
import { UpdateNotificationBanner } from '../../src/components/ui/UpdateNotificationBanner';
import {
  CURRENT_APP_VERSION,
  type VersionInfo,
  checkForUpdate,
  compareVersions,
  dismissUpdate,
  getDefaultUpdateEndpoint,
  isUpdateDismissed,
  resolveDownloadUrl,
} from '../../src/services/updateChecker';

describe('Update Checker Service & Version Comparison', () => {
  it('compareVersions handles standard and prefixed semver correctly', () => {
    expect(compareVersions('2.3.0', '2.2.0')).toBe(1);
    expect(compareVersions('v2.3.0', '2.2.0')).toBe(1);
    expect(compareVersions('2.2.1', '2.2.0')).toBe(1);
    expect(compareVersions('2.2.0', '2.2.0')).toBe(0);
    expect(compareVersions('v2.2.0', 'v2.2.0')).toBe(0);
    expect(compareVersions('2.1.9', '2.2.0')).toBe(-1);
    expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
    expect(compareVersions('3.0.0', '2.9.9')).toBe(1);
  });

  it('getDefaultUpdateEndpoint and resolveDownloadUrl adapt to extension context', () => {
    // In node/standard environment
    expect(getDefaultUpdateEndpoint()).toBe('/version.json');
    expect(resolveDownloadUrl('/internize-ai-extension.zip')).toBe('/internize-ai-extension.zip');

    // Simulate chrome-extension environment
    const originalWindow = globalThis.window;
    try {
      const globalWithWindow = globalThis as unknown as {
        window?: { location: { protocol: string } };
      };
      globalWithWindow.window = {
        location: {
          protocol: 'chrome-extension:',
        },
      };

      expect(getDefaultUpdateEndpoint()).toBe('https://internize-ai.vercel.app/version.json');
      expect(resolveDownloadUrl('/internize-ai-extension.zip')).toBe(
        'https://internize-ai.vercel.app/internize-ai-extension.zip',
      );
      expect(resolveDownloadUrl('https://custom.domain/ext.zip')).toBe(
        'https://custom.domain/ext.zip',
      );
    } finally {
      const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
      globalWithWindow.window = originalWindow;
    }
  });

  describe('checkForUpdate API behavior', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns updateAvailable: true when remote version is newer', async () => {
      const mockManifest: VersionInfo = {
        version: '2.3.0',
        releaseDate: '2026-11-15',
        downloadUrl: '/internize-ai-extension.zip',
        changelog: ['Fitur baru Sp.PD'],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockManifest,
      } as unknown as Response);

      const result = await checkForUpdate('2.2.0', '/version.json');
      expect(result.updateAvailable).toBe(true);
      expect(result.latestVersion).toBe('2.3.0');
      expect(result.currentVersion).toBe('2.2.0');
      expect(result.versionInfo?.downloadUrl).toBe('/internize-ai-extension.zip');

      // Verify Zero Egress invariant: fetch was called with GET and no sensitive query/body
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/version.json',
        expect.objectContaining({
          method: 'GET',
          cache: 'no-cache',
        }),
      );
    });

    it('returns updateAvailable: false when remote version is same or older', async () => {
      const mockManifest: VersionInfo = {
        version: '2.2.0',
        releaseDate: '2026-11-10',
        downloadUrl: '/internize-ai-extension.zip',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockManifest,
      } as unknown as Response);

      const result = await checkForUpdate('2.2.0', '/version.json');
      expect(result.updateAvailable).toBe(false);
      expect(result.latestVersion).toBe('2.2.0');
    });

    it('handles non-200 HTTP response gracefully without throwing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      const result = await checkForUpdate('2.2.0', '/version.json');
      expect(result.updateAvailable).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('handles network failure gracefully without throwing', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

      const result = await checkForUpdate('2.2.0', '/version.json');
      expect(result.updateAvailable).toBe(false);
      expect(result.error).toContain('Network disconnected');
    });
  });

  describe('dismissUpdate persistence', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = String(val);
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sets and reads dismissed status from localStorage', () => {
      expect(isUpdateDismissed('2.3.0')).toBe(false);
      dismissUpdate('2.3.0');
      expect(isUpdateDismissed('2.3.0')).toBe(true);
      expect(isUpdateDismissed('2.4.0')).toBe(false);
    });
  });
});

describe('UI Components: InstallGuideModal & UpdateNotificationBanner', () => {
  it('InstallGuideModal renders 3 installation steps and download CTA', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(InstallGuideModal, {
        isOpen: true,
        onClose: () => {},
        downloadUrl: '/internize-ai-extension.zip',
      }),
    );

    expect(html).toContain('Panduan Pemasangan &amp; Pembaruan');
    expect(html).toContain('Unduh &amp; Ekstrak Paket Ekstensi (.ZIP)');
    expect(html).toContain('chrome://extensions/');
    expect(html).toContain('Muat yang belum dibongkar');
    expect(html).toContain('internize-ai-extension.zip');
    expect(html).toContain('data-testid="install-guide-modal"');
    expect(html).toContain('data-testid="download-zip-btn"');
    expect(html).toContain('data-testid="copy-extension-url-btn"');
  });

  it('UpdateNotificationBanner renders version badge, changelog and action buttons', () => {
    const versionInfo: VersionInfo = {
      version: '2.3.0',
      releaseDate: '2026-11-15',
      downloadUrl: '/internize-ai-extension.zip',
      changelog: ['Update kalkulator Sp.PD & Vercel deployment'],
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(UpdateNotificationBanner, {
        versionInfo,
        currentVersion: '2.2.0',
        onOpenGuide: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('Pembaruan Ekstensi Tersedia!');
    expect(html).toContain('v2.3.0');
    expect(html).toContain('v2.2.0');
    expect(html).toContain('Update kalkulator Sp.PD &amp; Vercel deployment');
    expect(html).toContain('data-testid="update-notification-banner"');
    expect(html).toContain('data-testid="banner-download-btn"');
    expect(html).toContain('data-testid="banner-guide-btn"');
    expect(html).toContain('data-testid="banner-dismiss-btn"');
  });
});

interface VercelHeaderItem {
  key: string;
  value: string;
}

interface VercelHeaderRule {
  source: string;
  headers: VercelHeaderItem[];
}

interface VercelConfig {
  headers?: VercelHeaderRule[];
  rewrites?: Array<{ source: string; destination: string }>;
}

describe('Vercel & Distribution Configuration Verification', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  it('vercel.json enforces COOP and COEP headers for WebGPU/WASM Zero Egress', () => {
    const vercelConfigPath = path.join(projectRoot, 'vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const config: VercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    expect(config.headers).toBeDefined();

    const allRouteHeader = config.headers?.find((h: VercelHeaderRule) => h.source === '/(.*)');
    expect(allRouteHeader).toBeDefined();

    const coop = allRouteHeader?.headers.find(
      (h: VercelHeaderItem) => h.key === 'Cross-Origin-Opener-Policy',
    );
    expect(coop?.value).toBe('same-origin');

    const coep = allRouteHeader?.headers.find(
      (h: VercelHeaderItem) => h.key === 'Cross-Origin-Embedder-Policy',
    );
    expect(coep?.value).toBe('require-corp');

    expect(config.rewrites).toBeDefined();
    expect(config.rewrites?.length ?? 0).toBeGreaterThan(0);

    // Verify /version.json CORS and cache headers
    const versionHeader = config.headers?.find(
      (h: VercelHeaderRule) => h.source === '/version.json',
    );
    expect(versionHeader).toBeDefined();
    const versionCors = versionHeader?.headers.find(
      (h: VercelHeaderItem) => h.key === 'Access-Control-Allow-Origin',
    );
    expect(versionCors?.value).toBe('*');
    const versionCache = versionHeader?.headers.find(
      (h: VercelHeaderItem) => h.key === 'Cache-Control',
    );
    expect(versionCache?.value).toContain('no-cache');

    // Verify /internize-ai-extension.zip CORS header
    const zipHeader = config.headers?.find(
      (h: VercelHeaderRule) => h.source === '/internize-ai-extension.zip',
    );
    expect(zipHeader).toBeDefined();
    const zipCors = zipHeader?.headers.find(
      (h: VercelHeaderItem) => h.key === 'Access-Control-Allow-Origin',
    );
    expect(zipCors?.value).toBe('*');
  });

  it('manifest.json and public/manifest.json declare host_permissions for Vercel update checks', () => {
    const rootManifest = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'),
    );
    expect(rootManifest.host_permissions).toContain('https://internize-ai.vercel.app/*');

    const publicManifest = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'public/manifest.json'), 'utf8'),
    );
    expect(publicManifest.host_permissions).toContain('https://internize-ai.vercel.app/*');
  });

  it('public/sw.js explicitly bypasses caching for version.json and zip downloads', () => {
    const swPath = path.join(projectRoot, 'public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain("url.pathname === '/version.json'");
    expect(swContent).toContain("url.pathname.endsWith('.zip')");
  });

  it('docs/GOOGLE_SITES_BLUEPRINT.md exists and contains 3 main CTAs', () => {
    const blueprintPath = path.join(projectRoot, 'docs/GOOGLE_SITES_BLUEPRINT.md');
    expect(fs.existsSync(blueprintPath)).toBe(true);

    const content = fs.readFileSync(blueprintPath, 'utf8');
    expect(content).toContain('BUKA WEB APP');
    expect(content).toContain('DOWNLOAD EKSTENSI CHROME');
    expect(content).toContain('PANDUAN FITUR &amp; INSTALASI'.replace('&amp;', '&'));
    expect(content).toContain('Zero Egress');
    expect(content).toContain('121 PPK');
    expect(content).toContain('PAPDI');
  });

  it('package.json contains build:all and package:ext scripts', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts['build:all']).toBeDefined();
    expect(pkg.scripts['build:all']).toContain('build:ext');
    expect(pkg.scripts['build:all']).toContain('package_extension.ts');
    expect(pkg.scripts['build:all']).toContain('build:web');
    expect(pkg.scripts['package:ext']).toBe('tsx scripts/package_extension.ts');
  });
});
