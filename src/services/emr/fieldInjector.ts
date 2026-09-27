/**
 * fieldInjector.ts — EMR Form Field Injection Service
 * Sends a 'insert text' command from the side panel to the active tab's content script.
 * Compatible with both native inputs and React/Vue/Angular-controlled form elements.
 */

export interface InsertResult {
  success: boolean;
  method?: 'execCommand' | 'reactSetter' | 'clipboard';
  error?: string;
}

/**
 * Injects text into the currently focused input field in the active browser tab.
 * Falls back gracefully through multiple injection strategies.
 */
export async function insertTextToActiveField(text: string): Promise<InsertResult> {
  if (!text || typeof chrome === 'undefined' || !chrome.tabs?.query) {
    return { success: false, error: 'Chrome extension context not available' };
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: 'No active tab found' };
    }

    // Send injection message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_TEXT_TO_FIELD',
      text,
    });

    return (response as InsertResult) ?? { success: false, error: 'No response from content script' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to communicate with page',
    };
  }
}
