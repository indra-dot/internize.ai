import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Header } from '../../src/components/layout/Header';
import { SettingsTab } from '../../src/features/settings/SettingsTab';

describe('Milestone 5: Version Bump 2.1.0, Build Verification, and Packaging', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  it('Feature 17.1: package.json has version 2.1.0 and test:run script', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.version).toBe('2.1.0');
    expect(pkg.scripts['test:run']).toBe('vitest run');
  });

  it('Feature 17.2: manifest.json and public/manifest.json have version 2.1.0', () => {
    const rootManifestPath = path.join(projectRoot, 'manifest.json');
    const publicManifestPath = path.join(projectRoot, 'public/manifest.json');

    expect(fs.existsSync(rootManifestPath)).toBe(true);
    const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
    expect(rootManifest.version).toBe('2.1.0');

    expect(fs.existsSync(publicManifestPath)).toBe(true);
    const publicManifest = JSON.parse(fs.readFileSync(publicManifestPath, 'utf8'));
    expect(publicManifest.version).toBe('2.1.0');
  });

  it('Feature 17.3: package-lock.json has root and empty-key version 2.1.0', () => {
    const lockPath = path.join(projectRoot, 'package-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(lock.version).toBe('2.1.0');
    expect(lock.packages[''].version).toBe('2.1.0');
  });

  it('Feature 17.4: src/background/index.ts returns version 2.1.0 in PONG', () => {
    const bgPath = path.join(projectRoot, 'src/background/index.ts');
    expect(fs.existsSync(bgPath)).toBe(true);
    const bgContent = fs.readFileSync(bgPath, 'utf8');
    expect(bgContent).toContain("version: '2.1.0'");
  });

  it('Feature 17.5: Header.tsx renders Internize 2.1 and v2.1.0 badge', () => {
    const html = ReactDOMServer.renderToString(React.createElement(Header, {}));
    expect(html).toContain('Internize 2.1');
    expect(html).toContain('v2.1.0');
  });

  it('Feature 17.6: SettingsTab.tsx renders version 2.1.0 metadata display', () => {
    const html = ReactDOMServer.renderToString(React.createElement(SettingsTab, {}));
    expect(html).toContain('Versi 2.1.0');
    expect(html).toContain('v2.1.0');
  });

  it('Feature 18.1: internize-ai-extension.zip exists and bundles extension', () => {
    const zipPath = path.join(projectRoot, 'internize-ai-extension.zip');
    expect(fs.existsSync(zipPath)).toBe(true);
    const stats = fs.statSync(zipPath);
    // Bundle should be at least 1MB
    expect(stats.size).toBeGreaterThan(1024 * 1024);
  });
});

