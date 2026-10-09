/**
 * fieldInjector.ts — EMR Form Field Injection Service
 * Injects text into the focused field of the active tab on demand (see pageBridge.ts).
 * Compatible with both native inputs and React/Vue/Angular-controlled form elements.
 */

import { insertTextIntoFocusedField, runInActiveTab } from '../page/pageBridge';

export interface InsertResult {
  success: boolean;
  method?: 'execCommand' | 'reactSetter' | 'clipboard';
  error?: string;
}

const PAGE_ACCESS_HINT =
  'Halaman ini belum bisa diakses. Klik ikon internize.ai di halaman ini, lalu coba lagi.';

/**
 * Injects text into the currently focused input field in the active browser tab.
 * Falls back gracefully through multiple injection strategies.
 */
export async function insertTextToActiveField(text: string): Promise<InsertResult> {
  if (!text || typeof chrome === 'undefined' || !chrome.tabs?.query) {
    return { success: false, error: 'Chrome extension context not available' };
  }

  try {
    const result = await runInActiveTab(insertTextIntoFocusedField, [text]);
    if (!result) {
      return { success: false, error: 'No active tab found' };
    }
    return result;
  } catch {
    return { success: false, error: PAGE_ACCESS_HINT };
  }
}
