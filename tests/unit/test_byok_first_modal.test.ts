import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ByokFirstModal } from '../../src/components/ui/ByokFirstModal';
import * as geminiClient from '../../src/services/gemini/client';

describe('BYOK First Modal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockStorage = new Map<string, string>();
    (globalThis as unknown as Record<string, unknown>).localStorage = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, String(value)),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    };

    (globalThis as unknown as Record<string, unknown>).chrome = {
      storage: {
        local: {
          get: vi.fn((_keys, cb) => cb({})),
          set: vi.fn((_obj, cb) => cb?.()),
        },
      },
    };
  });

  it('renders null when isOpen is false', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ByokFirstModal, {
        isOpen: false,
        onClose: vi.fn(),
      }),
    );
    expect(html).toBe('');
  });

  it('renders BYOK First header, branding, and guidance when isOpen is true', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ByokFirstModal, {
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain('Setup AI Klinis (BYOK First)');
    expect(html).toContain('Bring Your Own Key');
    expect(html).toContain('Privasi 100% On-Device');
    expect(html).toContain('Langkah Awal');
    expect(html).toContain('Zero PHI Egress');
    expect(html).toContain('store: false');
  });

  it('provides direct link to Google AI Studio for 1-click free API key generation', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ByokFirstModal, {
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain('https://aistudio.google.com/app/apikey');
    expect(html).toContain('Ambil Kunci Gratis');
    expect(html).toContain('Belum punya Google Gemini API Key?');
  });

  it('renders API key input field, clipboard paste, and model selector with Gemini 3.8 Flash default', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ByokFirstModal, {
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain('byok-api-key-input');
    expect(html).toContain('Tempel Clipboard');
    expect(html).toContain('byok-model-select');
    expect(html).toContain('Gemini 3.8 Flash');
  });

  it('renders primary activation button and offline fallback option', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ByokFirstModal, {
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain('Simpan &amp; Aktifkan AI Sekarang');
    expect(html).toContain('Lewati Sementara (Gunakan Mode Offline CROGE 121 PPK)');
  });
});
