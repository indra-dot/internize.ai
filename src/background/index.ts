import type { ExtensionMessage } from '../types/messages';

/**
 * Configure Chrome Side Panel behavior to open immediately on toolbar action click.
 * This eliminates the popup window intermediary and provides a seamless single-click experience.
 */
export function configureSidePanel(): void {
  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
      console.warn('[internize.ai] Failed to set side panel behavior:', error);
    });
  }
}

/**
 * Injects selection listeners into existing tabs so highlighting works immediately
 * without requiring the user to reload open tabs.
 */
export async function injectIntoExistingTabs(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.scripting?.executeScript) return;
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }).catch(() => []);
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const win = window as unknown as { __internizeLiveAttached?: boolean };
            if (win.__internizeLiveAttached) return;
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
                }, () => {
                  void chrome.runtime?.lastError;
                });
              } catch {}
            };
            document.addEventListener('mouseup', emit, { passive: true });
            document.addEventListener('keyup', emit, { passive: true });
            document.addEventListener('selectionchange', () => {
              setTimeout(emit, 100);
            }, { passive: true });
          },
        }).catch(() => {
          // Consume error silently without logging to Chrome error console
        });
      }
    }
  } catch (err) {
    console.debug('[internize.ai] Auto-injection on install skipped:', err);
  }
}

// Register install lifecycle handler
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    configureSidePanel();
    injectIntoExistingTabs();
    console.info('[internize.ai] Service worker registered and configured.');
  });
}

// Top-level invocation for persistence across service worker wakes
configureSidePanel();

// Background message routing & health check handler
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse: (response?: unknown) => void) => {
      if (message.type === 'PING') {
        sendResponse({
          type: 'PONG',
          version: '0.1.0',
          uptime: performance.now(),
        });
        return true;
      }

      if (message.type === 'OPEN_SIDE_PANEL') {
        const windowId = sender.tab?.windowId;
        if (windowId && typeof chrome !== 'undefined' && chrome.sidePanel?.open) {
          chrome.sidePanel.open({ windowId }).catch((error: unknown) => {
            console.warn('[internize.ai] Failed to open side panel:', error);
          });
        }
        sendResponse({ status: 'ok' });
        return true;
      }

      if (message.type === 'TEXT_SELECTED') {
        // Acknowledge receipt so Chrome runtime doesn't log "Receiving end does not exist"
        // when content scripts broadcast highlighted text while side panel is closed
        sendResponse({ received: true });
        return true;
      }

      // Return false if message is not handled here, permitting other listeners (side panel) to respond
      return false;
    },
  );
}
