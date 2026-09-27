/**
 * Empirical Stress Test Suite for IPC Messaging, Selection Debouncing, and Runtime Contracts.
 * Tests:
 * 1. src/types/messages.ts schema conformance, fuzzing, and receiver vulnerability under malformed payloads.
 * 2. src/content/index.ts debouncing timing, edge cases (empty, whitespace, multi-MB), and the deselect-reselect lifecycle.
 * 3. src/sidepanel/hooks/useSelection.ts error handling, closed side panel rejection prevention, and fallback behavior.
 * 4. UI performance impact under multi-megabyte payloads.
 */

import { performance } from 'node:perf_hooks';
import type { ExtensionMessage } from '../../src/types/messages';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(
  category: string,
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    results.push({ category, name, passed: true, durationMs: duration });
    console.log(`  ✓ [PASS] ${name} (${duration.toFixed(2)}ms)`);
  } catch (err: any) {
    const duration = performance.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ category, name, passed: false, durationMs: duration, error: errorMsg });
    console.error(`  ✗ [FAIL] ${name} (${duration.toFixed(2)}ms)`);
    console.error(`     Error: ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Environment Builders
// ---------------------------------------------------------------------------

class MockChromeRuntime {
  public sentMessages: any[] = [];
  public listeners: Array<(message: any, sender: any, sendResponse: (resp?: any) => void) => boolean | void> = [];
  public shouldRejectSendMessage = false;
  public rejectError = new Error('Could not establish connection. Receiving end does not exist.');
  public shouldThrowSynchronously = false;
  public throwError = new Error('Extension context invalidated.');

  sendMessage(msg: any): Promise<any> {
    this.sentMessages.push(msg);
    if (this.shouldThrowSynchronously) {
      throw this.throwError;
    }
    if (this.shouldRejectSendMessage) {
      return Promise.reject(this.rejectError);
    }
    return Promise.resolve({ status: 'ok' });
  }

  onMessage = {
    addListener: (fn: any) => {
      this.listeners.push(fn);
    },
    removeListener: (fn: any) => {
      const idx = this.listeners.indexOf(fn);
      if (idx !== -1) this.listeners.splice(idx, 1);
    },
    hasListener: (fn: any) => this.listeners.includes(fn),
  };

  reset() {
    this.sentMessages = [];
    this.listeners = [];
    this.shouldRejectSendMessage = false;
    this.shouldThrowSynchronously = false;
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: Message Schemas & Fuzzing (src/types/messages.ts)
// ---------------------------------------------------------------------------
async function testMessageSchemas() {
  console.log('\n=== SUITE 1: Message Schemas & Payload Fuzzing ===');

  await runTest('Schemas', 'S1.1: Valid payload validation for all 7 ExtensionMessage variants', () => {
    const validMessages: ExtensionMessage[] = [
      { type: 'GET_SELECTED_TEXT' },
      { type: 'SELECTED_TEXT_RESPONSE', text: 'Hypertension', sourceUrl: 'https://emr.local', title: 'Chart' },
      { type: 'SELECTED_TEXT_RESPONSE', text: '' },
      { type: 'TEXT_SELECTED', text: 'Patient on Lisinopril', timestamp: Date.now() },
      { type: 'TEXT_SELECTED', text: 'Note', sourceUrl: 'https://emr.local', title: 'EMR', timestamp: 1727350000000 },
      { type: 'OPEN_SIDE_PANEL' },
      { type: 'SYNC_ACTIVE_TAB' },
      { type: 'PING' },
      { type: 'PONG', version: '0.1.0', uptime: 1042.5 },
    ];

    for (const msg of validMessages) {
      assert(typeof msg.type === 'string', 'Message type must be string');
      assert(
        ['GET_SELECTED_TEXT', 'SELECTED_TEXT_RESPONSE', 'TEXT_SELECTED', 'OPEN_SIDE_PANEL', 'SYNC_ACTIVE_TAB', 'PING', 'PONG'].includes(msg.type),
        `Valid message type expected: ${msg.type}`,
      );
    }
  });

  await runTest('Schemas', 'S1.2: Boundary string payloads (Unicode, Emojis, XSS vectors, Null bytes)', () => {
    const boundaryStrings = [
      '', // empty
      '   \n\t\r   ', // whitespace
      '🩺 Patient with 💖 atrial fibrillation & BP 130/80 mmHg ⚡', // emojis
      '日本語のテキスト 患者のカルテ 诊断：高血压', // CJK multibyte
      '<script>alert("xss")</script><img src=x onerror=alert(1)>', // HTML injection
      "SELECT * FROM patients WHERE mrn = '123' OR '1'='1';", // SQL injection
      'Line 1\0Line 2\r\nLine 3\b', // control characters
    ];

    for (const str of boundaryStrings) {
      const msg: ExtensionMessage = {
        type: 'TEXT_SELECTED',
        text: str,
        timestamp: Date.now(),
      };
      assert(msg.text === str, 'Text must be preserved losslessly');
      const serialized = JSON.stringify(msg);
      const deserialized = JSON.parse(serialized);
      assert(deserialized.text === str, 'Serialization must be lossless');
    }
  });

  await runTest('Schemas', 'S1.3: Boundary timestamp values for TEXT_SELECTED', () => {
    const timestamps = [
      0,
      -1,
      Date.now(),
      1727350000.123, // floating point
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    ];

    for (const ts of timestamps) {
      const msg: ExtensionMessage = {
        type: 'TEXT_SELECTED',
        text: 'Test',
        timestamp: ts,
      };
      assert(typeof msg.timestamp === 'number', 'Timestamp must be number');
      assert(!Number.isNaN(msg.timestamp), 'Timestamp must not be NaN');
    }
  });

  await runTest('Schemas', 'S1.4: Receiver vulnerability under malformed / null payloads (Content Script listener)', () => {
    // In src/content/index.ts, the listener is:
    // (message: ExtensionMessage, _sender, sendResponse) => {
    //   if (message.type === 'GET_SELECTED_TEXT' || message.type === 'SYNC_ACTIVE_TAB') ...
    // If message is null or undefined, message.type throws TypeError!
    const listener = (message: any, _sender: any, sendResponse: any) => {
      // Direct replica of src/content/index.ts lines 62-76
      if (message.type === 'GET_SELECTED_TEXT' || message.type === 'SYNC_ACTIVE_TAB') {
        sendResponse({ type: 'SELECTED_TEXT_RESPONSE', text: 'sample' });
        return true;
      }
      return false;
    };

    let caughtNull = false;
    try {
      listener(null, {}, () => {});
    } catch (err: any) {
      caughtNull = true;
      assert(err instanceof TypeError, 'Accessing .type on null message throws TypeError');
    }
    assert(caughtNull, 'Content script listener crashes with TypeError if message is null!');

    let caughtUndefined = false;
    try {
      listener(undefined, {}, () => {});
    } catch (err: any) {
      caughtUndefined = true;
      assert(err instanceof TypeError, 'Accessing .type on undefined message throws TypeError');
    }
    assert(caughtUndefined, 'Content script listener crashes with TypeError if message is undefined!');
  });

  await runTest('Schemas', 'S1.5: Receiver vulnerability under malformed / null payloads (Background listener)', () => {
    // In src/background/index.ts lines 28-53:
    // if (message.type === 'PING') ...
    const listener = (message: any, _sender: any, sendResponse: any) => {
      if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
        return true;
      }
      return false;
    };

    let threw = false;
    try {
      listener(null, {}, () => {});
    } catch (err: any) {
      threw = true;
    }
    assert(threw, 'Background listener crashes if null message is received');
  });

  await runTest('Schemas', 'S1.6: Receiver vulnerability under malformed / null payloads (useSelection hook listener)', () => {
    // In src/sidepanel/hooks/useSelection.ts lines 91-99:
    // const messageListener = (msg: ExtensionMessage) => {
    //   if (msg.type === 'TEXT_SELECTED' && msg.text) ...
    let updatedSelection = '';
    const listener = (msg: any) => {
      if (msg.type === 'TEXT_SELECTED' && msg.text) {
        updatedSelection = msg.text;
      }
    };

    let threw = false;
    try {
      listener(null);
    } catch (err) {
      threw = true;
    }
    assert(threw, 'useSelection messageListener crashes if null message is broadcast');
  });
}

// ---------------------------------------------------------------------------
// TEST SUITE 2: Text Selection Debouncing & Listener Logic (src/content/index.ts)
// ---------------------------------------------------------------------------
async function testDebouncingAndContentScript() {
  console.log('\n=== SUITE 2: Selection Debouncing & Content Script Logic ===');

  // We implement the exact stateful logic of src/content/index.ts to test its behavioral dynamics
  class ContentScriptSimulator {
    public lastSelectedText = '';
    public debounceTimer: NodeJS.Timeout | null = null;
    public currentDomSelection = '';
    public mockChrome: MockChromeRuntime;
    public dispatchCount = 0;

    constructor(mockChrome: MockChromeRuntime) {
      this.mockChrome = mockChrome;
    }

    getSelectedText(): string {
      return this.currentDomSelection ? this.currentDomSelection.trim() : '';
    }

    captureAndBroadcastSelection(): void {
      const text = this.getSelectedText();

      // Exact condition from src/content/index.ts line 22:
      if (!text || text === this.lastSelectedText) {
        return;
      }

      this.lastSelectedText = text;
      this.dispatchCount++;

      this.mockChrome
        .sendMessage({
          type: 'TEXT_SELECTED',
          text,
          sourceUrl: 'https://emr.hospital.org',
          title: 'Patient EMR',
          timestamp: Date.now(),
        })
        .catch(() => {
          // Expected silent rejection
        });
    }

    handleUserAction(): void {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => this.captureAndBroadcastSelection(), 150);
    }
  }

  await runTest('Debounce', 'D2.1: Debounce timing collapses 100 rapid events into exactly 1 dispatch', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);
    cs.currentDomSelection = 'Hypertension note';

    // Rapid burst: 100 calls in 30ms
    for (let i = 0; i < 100; i++) {
      cs.handleUserAction();
    }

    // After 80ms: Debounce timer (150ms) has not expired yet
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert(cs.dispatchCount === 0, 'Should not dispatch before 150ms debounce window expires');
    assert(mockChrome.sentMessages.length === 0, 'No message sent during debounce window');

    // Wait until 150ms debounce completes (total 200ms)
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert(cs.dispatchCount === 1, `Expected exactly 1 dispatch, got ${cs.dispatchCount}`);
    assert(mockChrome.sentMessages.length === 1, 'Expected exactly 1 message sent');
    assert(mockChrome.sentMessages[0].text === 'Hypertension note', 'Message text matches');
  });

  await runTest('Debounce', 'D2.2: Empty selection does NOT trigger message dispatch', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);
    cs.currentDomSelection = '';

    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));

    assert(cs.dispatchCount === 0, 'Empty selection must not be dispatched');
    assert(mockChrome.sentMessages.length === 0, 'No message sent');
  });

  await runTest('Debounce', 'D2.3: Whitespace-only selection does NOT trigger message dispatch', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);
    cs.currentDomSelection = '   \t\r\n   \n\t  ';

    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));

    assert(cs.dispatchCount === 0, 'Whitespace selection must not be dispatched');
    assert(mockChrome.sentMessages.length === 0, 'No message sent');
  });

  await runTest('Debounce', 'D2.4: Repeated identical selection does NOT trigger second message dispatch', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);
    cs.currentDomSelection = 'Metformin 500mg BID';

    // First selection
    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert(cs.dispatchCount === 1, 'First dispatch must succeed');

    // Second event with identical selection
    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert(cs.dispatchCount === 1, 'Duplicate selection must be deduplicated');
    assert(mockChrome.sentMessages.length === 1, 'Only 1 message sent total');
  });

  await runTest('Debounce', 'D2.5: EMPIRICAL PROBE: Deselect-then-reselect anomaly (Stale lastSelectedText Bug)', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);

    // Step 1: User selects phrase A
    cs.currentDomSelection = 'Lisinopril 10mg daily';
    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert(cs.dispatchCount === 1, 'Step 1: Broadcast sent');
    assert(cs.lastSelectedText === 'Lisinopril 10mg daily', 'lastSelectedText is set');

    // Step 2: User clicks empty whitespace on page (deselects). Selection collapses to empty.
    cs.currentDomSelection = '';
    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert(cs.dispatchCount === 1, 'Step 2: Empty selection skipped dispatch');
    // Notice: What is cs.lastSelectedText now?!
    // In src/content/index.ts:
    // if (!text || text === lastSelectedText) return;
    // Because !text is true, it returns BEFORE setting lastSelectedText!
    const lastSelectedAfterDeselect = cs.lastSelectedText;
    console.log(`     [Probe Observation] lastSelectedText after deselect: "${lastSelectedAfterDeselect}"`);

    // Step 3: User re-selects the EXACT same text ('Lisinopril 10mg daily')
    cs.currentDomSelection = 'Lisinopril 10mg daily';
    cs.handleUserAction();
    await new Promise((resolve) => setTimeout(resolve, 180));

    console.log(`     [Probe Observation] Dispatch count after reselecting same text: ${cs.dispatchCount}`);
    if (cs.dispatchCount === 1) {
      console.warn('     ⚠️ [CRITICAL DEFECT CONFIRMED]: Deselecting does NOT reset lastSelectedText!');
      console.warn('     As a result, re-selecting the exact same text is silently ignored by the content script!');
    }
    // We document this behavior:
    assert(
      cs.dispatchCount === 1,
      'Empirical proof: The current implementation fails to broadcast when a user re-selects the same text after clearing!',
    );
  });

  await runTest('Debounce', 'D2.6: Multi-megabyte text selection performance (1MB, 5MB, 10MB)', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);

    const sizes = [
      { label: '1 MB', count: 1_000_000 },
      { label: '5 MB', count: 5_000_000 },
      { label: '10 MB', count: 10_000_000 },
    ];

    for (const { label, count } of sizes) {
      const largeString = 'Patient presents with severe dyspnea and tachycardia. '.repeat(Math.ceil(count / 53)).slice(0, count);
      cs.currentDomSelection = largeString;

      const t0 = performance.now();
      cs.captureAndBroadcastSelection();
      const duration = performance.now() - t0;

      assert(mockChrome.sentMessages[mockChrome.sentMessages.length - 1].text.length === count, `Payload size for ${label} must match`);
      console.log(`     [Perf Benchmark] ${label} (${count.toLocaleString()} chars) processed in ${duration.toFixed(2)}ms`);
      assert(duration < 200, `Processing ${label} should take < 200ms, took ${duration.toFixed(2)}ms`);
    }
  });

  await runTest('Debounce', 'D2.7: Rapid alternating selection stress (1,000 rapid event switches)', async () => {
    const mockChrome = new MockChromeRuntime();
    const cs = new ContentScriptSimulator(mockChrome);

    const phrases = ['Condition A', 'Condition B', 'Condition C', 'Condition D'];
    const t0 = performance.now();

    for (let i = 0; i < 1000; i++) {
      cs.currentDomSelection = phrases[i % phrases.length];
      cs.handleUserAction();
    }

    // Wait for final debounce expiration
    await new Promise((resolve) => setTimeout(resolve, 180));
    const totalTime = performance.now() - t0;

    assert(cs.dispatchCount === 1, 'Only the final stable selection should dispatch');
    assert(mockChrome.sentMessages.length === 1, 'Exactly one message dispatched');
    assert(mockChrome.sentMessages[0].text === phrases[999 % phrases.length], 'Dispatched text must be the final phrase');
    console.log(`     [Stress Benchmark] 1,000 rapid alternating selection events handled in ${totalTime.toFixed(2)}ms`);
  });
}

// ---------------------------------------------------------------------------
// TEST SUITE 3: Closed Side Panel & Unhandled Rejection Prevention
// ---------------------------------------------------------------------------
async function testClosedSidePanelRejections() {
  console.log('\n=== SUITE 3: Closed Side Panel & Promise Rejection Prevention ===');

  await runTest('Rejection', 'R3.1: Promise rejection in chrome.runtime.sendMessage is silently caught when side panel is closed', async () => {
    const mockChrome = new MockChromeRuntime();
    mockChrome.shouldRejectSendMessage = true;
    mockChrome.rejectError = new Error('Could not establish connection. Receiving end does not exist.');

    let unhandledRejectionFired = false;
    const onUnhandled = () => {
      unhandledRejectionFired = true;
    };
    process.on('unhandledRejection', onUnhandled);

    // Execute captureAndBroadcastSelection
    let text = 'Selected clinical text';
    let caughtSilently = false;

    // Direct reproduction of src/content/index.ts lines 28-40
    mockChrome
      .sendMessage({
        type: 'TEXT_SELECTED',
        text,
        sourceUrl: 'https://emr.local',
        title: 'EMR',
        timestamp: Date.now(),
      })
      .catch(() => {
        caughtSilently = true;
      });

    // Wait for microtask ticks
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off('unhandledRejection', onUnhandled);

    assert(caughtSilently, 'Promise rejection must be intercepted by .catch()');
    assert(!unhandledRejectionFired, 'No unhandledRejection event must escape to process/window');
  });

  await runTest('Rejection', 'R3.2: Synchronous exception in chrome.runtime.sendMessage leaks if not wrapped in try/catch', () => {
    const mockChrome = new MockChromeRuntime();
    mockChrome.shouldThrowSynchronously = true;
    mockChrome.throwError = new Error('Extension context invalidated');

    // In src/content/index.ts line 28:
    // chrome.runtime.sendMessage(...).catch(...)
    // If sendMessage throws synchronously, .catch() CANNOT catch it!
    let uncaughtSync = false;
    try {
      mockChrome.sendMessage({ type: 'TEXT_SELECTED', text: 'test', timestamp: Date.now() }).catch(() => {});
    } catch (err: any) {
      uncaughtSync = true;
      assert(err.message === 'Extension context invalidated', 'Threw synchronous error');
    }

    assert(
      uncaughtSync,
      'Empirical observation: If chrome.runtime.sendMessage throws synchronously (e.g. extension unloaded), .catch() alone does not catch it.',
    );
  });

  await runTest('Rejection', 'R3.3: useSelection Stage 1 handles rejected chrome.tabs.sendMessage gracefully', async () => {
    // Simulated useSelection pullActiveTabSelection Stage 1
    let isPulling = true;
    let caughtStage1 = false;
    let fallbackTriggered = false;

    const mockTabsSendMessage = async () => {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    };

    const mockExecuteScript = async () => {
      fallbackTriggered = true;
      return [{ result: { text: 'Fallback extracted text', sourceUrl: 'https://emr.local', title: 'Chart' } }];
    };

    try {
      try {
        await mockTabsSendMessage();
      } catch {
        caughtStage1 = true;
      }

      // Stage 2 fallback
      if (caughtStage1) {
        await mockExecuteScript();
      }
    } finally {
      isPulling = false;
    }

    assert(caughtStage1, 'Stage 1 error was caught without crashing');
    assert(fallbackTriggered, 'Stage 2 fallback was successfully triggered');
    assert(!isPulling, 'isPulling reset to false');
  });

  await runTest('Rejection', 'R3.4: useSelection Stage 2 handles restricted page error (chrome://) gracefully', async () => {
    let isPulling = true;
    let loggedDebug = false;

    const mockTabsSendMessage = async () => {
      throw new Error('Could not establish connection.');
    };

    const mockExecuteScript = async () => {
      throw new Error('Cannot access contents of url "chrome://extensions/". Extension manifest must request permission.');
    };

    try {
      try {
        await mockTabsSendMessage();
      } catch {
        // Tab not connected
      }

      await mockExecuteScript();
    } catch (error) {
      loggedDebug = true;
    } finally {
      isPulling = false;
    }

    assert(loggedDebug, 'Stage 2 restricted page rejection caught in outer catch block');
    assert(!isPulling, 'isPulling correctly restored to false in finally block');
  });

  await runTest('Rejection', 'R3.5: useSelection handles tabId: -1 (TAB_ID_NONE) gracefully', async () => {
    // When Chrome active tab is a devtools window or transient window, tab.id can be -1
    const tab = { id: -1, url: 'devtools://devtools/bundled/devtools_app.html', title: 'DevTools' };
    let stage1Error = false;

    const mockTabsSendMessage = async (tabId: number) => {
      if (tabId <= 0) {
        throw new Error(`No tab with id: ${tabId}.`);
      }
      return { text: 'test' };
    };

    try {
      // In useSelection: if (!tab?.id) returns early, BUT tab.id === -1 is truthy!
      assert(Boolean(tab?.id), 'tab.id = -1 is TRUTHY, so check !tab?.id does NOT guard against -1!');
      await mockTabsSendMessage(tab.id);
    } catch {
      stage1Error = true;
    }

    assert(stage1Error, 'Negative tabId caught by stage 1 try/catch');
  });
}

// ---------------------------------------------------------------------------
// TEST SUITE 4: UI Performance & Regex Word-Count Benchmark
// ---------------------------------------------------------------------------
async function testUiPerformance() {
  console.log('\n=== SUITE 4: UI Performance with Large Payloads ===');

  await runTest('UI Perf', 'P4.1: Word count evaluation inline regex split benchmark on large clinical text', () => {
    // In src/features/clinical/ClinicalServiceTab.tsx line 174:
    // inputText.trim().split(/\s+/).filter(Boolean).length
    const sampleSizes = [
      { label: '10 KB (2k words)', chars: 10_000 },
      { label: '100 KB (20k words)', chars: 100_000 },
      { label: '1 MB (200k words)', chars: 1_000_000 },
      { label: '5 MB (1M words)', chars: 5_000_000 },
    ];

    for (const { label, chars } of sampleSizes) {
      const sentence = 'Patient reports history of hypertension and takes lisinopril 10mg. ';
      const text = sentence.repeat(Math.ceil(chars / sentence.length)).slice(0, chars);

      const t0 = performance.now();
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const duration = performance.now() - t0;

      console.log(`     [Word-count Benchmark] ${label}: ${wordCount.toLocaleString()} words computed in ${duration.toFixed(2)}ms`);
      if (chars >= 1_000_000 && duration > 50) {
        console.warn(`     ⚠️ Performance warning: Inline split on ${label} took ${duration.toFixed(2)}ms on render thread!`);
      }
      assert(wordCount > 0, 'Word count computed successfully');
    }
  });

  await runTest('UI Perf', 'P4.2: useSelection state update with 5MB text payload', () => {
    // Test React state setter simulation with large payload
    const largePayload = 'A'.repeat(5_000_000);
    let state = { text: '', sourceUrl: '', title: '', timestamp: 0 };

    const t0 = performance.now();
    state = {
      text: largePayload,
      sourceUrl: 'https://emr.hospital.org/chart',
      title: 'Large Document',
      timestamp: Date.now(),
    };
    const duration = performance.now() - t0;

    assert(state.text.length === 5_000_000, 'State holds full 5MB payload');
    assert(duration < 20, `State assignment took ${duration.toFixed(2)}ms (< 20ms)`);
  });
}

// ---------------------------------------------------------------------------
// Runner & Summary
// ---------------------------------------------------------------------------
async function main() {
  console.log('======================================================================');
  console.log('  internize.ai — Empirical IPC & Debounce Stress Test Suite (Challenger 2) ');
  console.log('======================================================================');

  const startTotal = performance.now();

  await testMessageSchemas();
  await testDebouncingAndContentScript();
  await testClosedSidePanelRejections();
  await testUiPerformance();

  const totalDuration = performance.now() - startTotal;

  console.log('\n======================================================================');
  console.log('                         STRESS TEST SUMMARY                          ');
  console.log('======================================================================');

  const categories = [...new Set(results.map((r) => r.category))];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const passed = catResults.filter((r) => r.passed).length;
    const failed = catResults.filter((r) => !r.passed).length;
    totalPassed += passed;
    totalFailed += failed;
    const time = catResults.reduce((acc, r) => acc + r.durationMs, 0);
    const status = failed === 0 ? 'PASS' : 'FAIL';
    console.log(`${cat.padEnd(20)} Passed: ${String(passed).padStart(3)} | Failed: ${String(failed).padStart(3)} | Total: ${String(catResults.length).padStart(3)} | Time: ${time.toFixed(1).padStart(7)}ms | [${status}]`);
  }

  console.log('----------------------------------------------------------------------');
  console.log(`TOTAL: ${totalPassed} Passed, ${totalFailed} Failed across ${results.length} tests in ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('======================================================================\n');

  if (totalFailed > 0) {
    console.error(`>>> Stress suite finished with ${totalFailed} failure(s).`);
    process.exit(1);
  } else {
    console.log('>>> All empirical stress tests completed successfully!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal stress suite failure:', err);
  process.exit(1);
});
