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

// Register install lifecycle handler
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    configureSidePanel();
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
        // when the page listener broadcasts highlighted text while side panel is closed
        sendResponse({ received: true });
        return true;
      }

      // Return false if message is not handled here, permitting other listeners (side panel) to respond
      return false;
    },
  );
}
