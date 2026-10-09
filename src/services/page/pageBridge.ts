/**
 * pageBridge.ts
 * =============
 * On-demand access to the active tab. There is no static content script in
 * manifest.json: the extension only touches a page when the user asks for it
 * (activeTab grant), so it does not run on every website.
 *
 * Functions passed to chrome.scripting.executeScript are serialized with
 * toString() and run inside the page. Each one MUST be fully self-contained:
 * no imports and no references to module-level values.
 */

import type { InsertTextResponseMessage } from '../../types/messages';

export interface PageSelection {
  text: string;
  sourceUrl: string;
  title: string;
}

/**
 * Runs `func` inside the active tab and returns its result.
 * Returns null when no tab is found. Throws when the page cannot be accessed
 * (restricted pages, or no activeTab grant yet).
 */
export async function runInActiveTab<A extends unknown[], R>(
  func: (...args: A) => R,
  args: A,
): Promise<R | null> {
  let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (!tab?.id) return null;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args,
  });
  return (injection?.result as R | undefined) ?? null;
}

/**
 * Attaches a selection listener to the page (once per page) and returns the
 * current selection. New selections are pushed to the extension as TEXT_SELECTED.
 */
export function attachSelectionListener(): PageSelection {
  const win = window as unknown as { __internizeLiveAttached?: boolean };
  if (!win.__internizeLiveAttached) {
    win.__internizeLiveAttached = true;
    let prevText = '';
    const emit = () => {
      const sel = window.getSelection()?.toString().trim() || '';
      if (!sel) {
        prevText = '';
        return;
      }
      if (sel === prevText) return;
      prevText = sel;
      try {
        chrome.runtime?.sendMessage?.(
          {
            type: 'TEXT_SELECTED',
            text: sel,
            sourceUrl: window.location.href,
            title: document.title,
            timestamp: Date.now(),
          },
          () => {
            void chrome.runtime?.lastError;
          },
        );
      } catch {
        // Side panel closed or extension reloaded: ignore
      }
    };
    document.addEventListener('mouseup', emit, { passive: true });
    document.addEventListener('keyup', emit, { passive: true });
    document.addEventListener(
      'selectionchange',
      () => {
        setTimeout(emit, 100);
      },
      { passive: true },
    );
  }

  return {
    text: window.getSelection()?.toString().trim() || '',
    sourceUrl: window.location.href,
    title: document.title,
  };
}

/**
 * Inserts text into the focused input, textarea or contenteditable element.
 * Strategies, in order: execCommand, React/Vue-safe value setter, Range insert,
 * then clipboard as a last resort.
 */
export function insertTextIntoFocusedField(text: string): InsertTextResponseMessage {
  const pickTarget = (): HTMLElement | null => {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active.isContentEditable)
    ) {
      return active;
    }
    const fallback =
      (document.querySelector('textarea:not([readonly]):not([disabled])') as HTMLElement | null) ||
      (document.querySelector(
        'input[type="text"]:not([readonly]):not([disabled])',
      ) as HTMLElement | null);
    if (fallback) fallback.focus();
    return fallback;
  };

  const el = pickTarget();
  if (!el) {
    return {
      type: 'INSERT_TEXT_RESPONSE',
      success: false,
      error: 'Tidak ada field teks yang aktif. Klik dulu pada field di halaman EMR.',
    };
  }

  el.focus();

  // Strategy 1: execCommand (native inputs and plain contenteditable)
  try {
    if (document.execCommand('insertText', false, text)) {
      return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'execCommand' };
    }
  } catch {
    // Not supported on this element: try next strategy
  }

  // Strategy 2: native value setter + synthetic events (React/Vue-controlled inputs)
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        const current = el.value;
        const start = el.selectionStart ?? current.length;
        const end = el.selectionEnd ?? current.length;
        setter.call(el, current.slice(0, start) + text + current.slice(end));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try {
          el.setSelectionRange(start + text.length, start + text.length);
        } catch {
          // Some input types (e.g. number, email) do not support selection: value is already set
        }
        return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'reactSetter' };
      }
    } catch {
      // Descriptor unavailable: fall through
    }
  }

  // Strategy 3: Range insert (rich text editors such as Epic or Cerner)
  if (el.isContentEditable) {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'execCommand' };
      }
    } catch {
      // Fall through to clipboard
    }
  }

  // Strategy 4: clipboard fallback
  navigator.clipboard.writeText(text).catch(() => {});
  return {
    type: 'INSERT_TEXT_RESPONSE',
    success: false,
    method: 'clipboard',
    error: 'Teks telah disalin ke clipboard. Tekan Ctrl+V untuk menempelkan secara manual.',
  };
}
