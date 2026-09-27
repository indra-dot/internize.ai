import type { ExtensionMessage, InsertTextResponseMessage } from '../types/messages';

let lastSelectedText = '';
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Extracts currently selected text from the DOM.
 */
export function getSelectedText(): string {
  if (typeof window === 'undefined') return '';
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

/**
 * Captures selected text and broadcasts it to the extension runtime.
 */
export function captureAndBroadcastSelection(): void {
  const text = getSelectedText();

  // If selection is cleared, reset tracking so same text can be selected again
  if (!text) {
    lastSelectedText = '';
    return;
  }

  // Skip identical repeat events to minimize IPC overhead
  if (text === lastSelectedText) {
    return;
  }

  lastSelectedText = text;

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'TEXT_SELECTED',
          text,
          sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
          title: typeof document !== 'undefined' ? document.title : '',
          timestamp: Date.now(),
        } satisfies ExtensionMessage,
        () => {
          // Explicitly checking chrome.runtime.lastError prevents Chrome from logging
          // "Unchecked runtime.lastError: Could not establish connection" to chrome://extensions
          void chrome.runtime?.lastError;
        },
      );
    } catch {
      // Ignore synchronous IPC errors
    }
  }
}

/**
 * Debounces user interaction events to prevent excessive IPC message dispatch.
 */
export function handleUserAction(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(captureAndBroadcastSelection, 150);
}

// Bind DOM selection event listeners in browser environment
if (typeof document !== 'undefined') {
  document.addEventListener('mouseup', handleUserAction, { passive: true });
  document.addEventListener('keyup', handleUserAction, { passive: true });
  document.addEventListener('selectionchange', handleUserAction, { passive: true });
}

/**
 * Injects text into a focused or last-focused input/textarea/contenteditable element.
 * Uses three strategies in order:
 *   1. document.execCommand('insertText') — works for native inputs and plain contenteditable
 *   2. React/Vue property setter + synthetic Event — works for React/Vue-controlled inputs
 *   3. Clipboard write — last resort fallback with user notice
 */
export function injectTextIntoFocusedField(text: string): InsertTextResponseMessage {
  const activeEl = document.activeElement as HTMLElement | null;

  // Determine if the active element can receive text
  const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
  const isContentEditable = activeEl?.isContentEditable ?? false;

  if (!activeEl || (!isInput && !isContentEditable)) {
    // Attempt to find a visible text field on the page as fallback
    const fallbackEl =
      (document.querySelector('textarea:not([readonly]):not([disabled])') as HTMLTextAreaElement | null) ||
      (document.querySelector('input[type="text"]:not([readonly]):not([disabled])') as HTMLInputElement | null);

    if (fallbackEl) {
      fallbackEl.focus();
      return injectTextIntoFocusedField(text); // recurse with focus set
    }

    return {
      type: 'INSERT_TEXT_RESPONSE',
      success: false,
      error: 'Tidak ada field teks yang aktif. Klik dulu pada field di halaman EMR.',
    };
  }

  // Strategy 1: execCommand — works for most native + plain editors
  try {
    activeEl.focus();
    const inserted = document.execCommand('insertText', false, text);
    if (inserted) {
      return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'execCommand' };
    }
  } catch {
    // execCommand may throw on some browsers/elements — try next strategy
  }

  // Strategy 2: React/Vue synthetic setter
  // React intercepts the native setter, so we use the original prototype setter
  // then dispatch a synthetic 'input' event so React's onChange fires.
  if (isInput) {
    try {
      const nativeInputDescriptor = Object.getOwnPropertyDescriptor(
        activeEl instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value',
      );
      if (nativeInputDescriptor?.set) {
        const currentVal = (activeEl as HTMLInputElement | HTMLTextAreaElement).value;
        const selStart = (activeEl as HTMLInputElement | HTMLTextAreaElement).selectionStart ?? currentVal.length;
        const selEnd = (activeEl as HTMLInputElement | HTMLTextAreaElement).selectionEnd ?? currentVal.length;
        const newVal = currentVal.slice(0, selStart) + text + currentVal.slice(selEnd);
        nativeInputDescriptor.set.call(activeEl, newVal);
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        // Restore cursor position after inserted text
        const newCursor = selStart + text.length;
        (activeEl as HTMLInputElement).setSelectionRange(newCursor, newCursor);
        return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'reactSetter' };
      }
    } catch {
      // property descriptor unavailable — fall through
    }
  }

  // Strategy 3: contentEditable (e.g. rich text editors in Epic, Cerner)
  if (isContentEditable) {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        return { type: 'INSERT_TEXT_RESPONSE', success: true, method: 'execCommand' };
      }
    } catch {
      // ignore
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

// Respond to pull queries from the side panel
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse: (response?: unknown) => void) => {
      if (message.type === 'GET_SELECTED_TEXT' || message.type === 'SYNC_ACTIVE_TAB') {
        const text = getSelectedText();
        sendResponse({
          type: 'SELECTED_TEXT_RESPONSE',
          text,
          sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
          title: typeof document !== 'undefined' ? document.title : '',
        } satisfies ExtensionMessage);
        return true;
      }

      if (message.type === 'INSERT_TEXT_TO_FIELD') {
        const result = injectTextIntoFocusedField(message.text);
        sendResponse(result);
        return true;
      }

      return false;
    },
  );
}

