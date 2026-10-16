import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Modal } from '../../src/components/ui/Modal';
import { ClinicalServiceTab } from '../../src/features/clinical/ClinicalServiceTab';
import { PpkExplorerModal } from '../../src/features/clinical/PpkExplorerModal';
import { PrivacySensorPreviewModal } from '../../src/features/clinical/PrivacySensorPreviewModal';

describe('Milestone 1: UI/UX Fixes (Single Sample Button & Modal Scroll Hardening)', () => {
  it('ClinicalServiceTab renders only one sample button placed in the empty state with clean label', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ClinicalServiceTab, { initialText: '' }),
    );

    // 1. Bottom empty-state button exists
    expect(html).toContain('data-testid="empty-state-sample-preop-btn"');
    expect(html).toContain('Coba Contoh Kasus Pre-Op (1-Klik)');

    // 2. Redundant top button removed
    expect(html).not.toContain('data-testid="prominent-sample-preop-btn"');

    // 3. No double lightning emoji [ ⚡ Coba... ]
    expect(html).not.toContain('[ ⚡ Coba Contoh Kasus Pre-Op (1-Klik) ]');
  });

  it('Modal component correctly respects hideCloseButton and bodyClassName', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(
        Modal,
        {
          isOpen: true,
          onClose: () => {},
          hideCloseButton: true,
          bodyClassName: 'flex flex-col flex-1 min-h-0 overflow-hidden p-0',
        },
        React.createElement('div', { id: 'inner-content' }, 'Test Content'),
      ),
    );

    // Should NOT have the absolute close button
    expect(html).not.toContain('aria-label="Close modal"');
    // Should pass the custom bodyClassName
    expect(html).toContain('flex flex-col flex-1 min-h-0 overflow-hidden p-0');
    expect(html).toContain('Test Content');
  });

  it('PpkExplorerModal uses hideCloseButton, flex min-h-0 container, and provides mobile back bar', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(PpkExplorerModal, {
        isOpen: true,
        onClose: () => {},
      }),
    );

    // 1. Should have modal title and PPK Explorer header
    expect(html).toContain('PPK Explorer Sp.PD (121 Panduan)');
    expect(html).toContain('PAPDI 2024');

    // 2. Custom header close button exists
    expect(html).toContain('title="Tutup (Esc)"');
    // But modal default close button does NOT exist (no double close button)
    expect(html).not.toContain('aria-label="Close modal"');

    // 3. Layout has proper flexbox min-h-0 for vertical scrolling
    expect(html).toContain('min-h-0');
    expect(html).toContain('overflow-y-auto');

    // 4. Mobile focus bar is present for narrow viewports
    expect(html).toContain('← Ganti PPK / Tampilkan Daftar');
  });

  it('PrivacySensorPreviewModal uses hideCloseButton and bodyClassName', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(PrivacySensorPreviewModal, {
        isOpen: true,
        onClose: () => {},
        rawText: 'Pasien Tn. Budi NIK 3171012345678901',
      }),
    );

    expect(html).toContain('Pratinjau Sensor Privasi');
    expect(html).toContain('title="Tutup (Esc)"');
    expect(html).not.toContain('aria-label="Close modal"');
    expect(html).toContain('flex flex-col flex-1 min-h-0 overflow-hidden p-0');
  });
});
