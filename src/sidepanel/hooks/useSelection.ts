import { useCallback, useEffect, useState } from 'react';
import { attachSelectionListener, runInActiveTab } from '../../services/page/pageBridge';
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
   * Pulls the currently selected text from the active tab on demand.
   * Injects the selection listener into the page (see pageBridge.ts), so it
   * only works on pages the user has granted access to (activeTab).
   */
  const pullActiveTabSelection = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return;
    }

    setIsPulling(true);
    try {
      const res = await runInActiveTab(attachSelectionListener, []);

      if (res?.text) {
        setSelection({
          text: res.text,
          sourceUrl: res.sourceUrl,
          title: res.title,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      // Expected on restricted pages (chrome://, Web Store) or before activeTab is granted
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

    // Listen for live push notifications from the injected page listener
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
