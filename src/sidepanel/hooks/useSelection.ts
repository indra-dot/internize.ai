import { useCallback, useEffect, useState } from 'react';
import type { ExtensionMessage } from '../../types/messages';

export interface SelectionState {
  text: string;
  sourceUrl?: string;
  title?: string;
  timestamp?: number;
}

export function useSelection() {
  const [selection, setSelection] = useState<SelectionState>({ text: '' });
  const [isPulling, setIsPulling] = useState<boolean>(false);

  /**
   * Proactively pulls currently selected text from the active tab.
   * Stage 1: chrome.tabs.sendMessage (fast IPC).
   * Stage 2: chrome.scripting.executeScript fallback.
   */
  const pullActiveTabSelection = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return;
    }

    setIsPulling(true);
    try {
      let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      if (!tab?.id) {
        setIsPulling(false);
        return;
      }

      // Stage 1: Direct IPC messaging to content script
      try {
        const response = (await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_SELECTED_TEXT',
        } satisfies ExtensionMessage)) as { text?: string; sourceUrl?: string; title?: string };

        if (response?.text) {
          setSelection({
            text: response.text,
            sourceUrl: response.sourceUrl || tab.url,
            title: response.title || tab.title,
            timestamp: Date.now(),
          });
          setIsPulling(false);
          return;
        }
      } catch {
        // Tab might have been loaded before extension install or scripting not initialized yet
      }

      // Stage 2: Fallback to chrome.scripting.executeScript
      if (chrome.scripting?.executeScript) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Ensure live selection listener is bound even on tabs opened before extension install
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
                  chrome.runtime?.sendMessage?.({
                    type: 'TEXT_SELECTED',
                    text: sel,
                    sourceUrl: window.location.href,
                    title: document.title,
                    timestamp: Date.now(),
                  }).catch(() => {});
                } catch {
                  // silent
                }
              };
              document.addEventListener('mouseup', emit, { passive: true });
              document.addEventListener('keyup', emit, { passive: true });
              document.addEventListener('selectionchange', () => {
                setTimeout(emit, 100);
              }, { passive: true });
            }

            return {
              text: window.getSelection()?.toString().trim() || '',
              sourceUrl: window.location.href,
              title: document.title,
            };
          },
        });

        const res = results?.[0]?.result;
        if (res?.text) {
          setSelection({
            text: res.text,
            sourceUrl: res.sourceUrl || tab.url,
            title: res.title || tab.title,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      // Ignored for restricted pages (chrome://, webstore, etc.)
      console.debug('[internize.ai] Selection pull unavailable on active tab:', error);
    } finally {
      setIsPulling(false);
    }
  }, []);

  useEffect(() => {
    // Initial pull on mount (< 2s acceptance requirement)
    pullActiveTabSelection();

    // Listen for window focus and tab activation to pull selections proactively
    const handleFocus = () => {
      pullActiveTabSelection();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    const tabActivatedListener = () => {
      pullActiveTabSelection();
    };

    if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(tabActivatedListener);
    }

    // Listen for live push notifications from content scripts
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
        if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
          chrome.tabs.onActivated.removeListener(tabActivatedListener);
        }
      };
    }

    const messageListener = (msg: ExtensionMessage) => {
      if (msg.type === 'TEXT_SELECTED' && msg.text) {
        setSelection({
          text: msg.text,
          sourceUrl: msg.sourceUrl,
          title: msg.title,
          timestamp: msg.timestamp,
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.removeListener(tabActivatedListener);
      }
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [pullActiveTabSelection]);

  const clearSelection = useCallback(() => {
    setSelection({ text: '' });
  }, []);

  return {
    selection,
    isPulling,
    pullActiveTabSelection,
    clearSelection,
    setSelectionText: (text: string) => setSelection((prev) => ({ ...prev, text })),
  };
}
