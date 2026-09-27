import { registry, TestCase, TestResult, TierSummary } from './harness';

// Import all 4 test tiers so they register their test cases
import './tier1_features.test';
import './tier2_boundaries.test';
import './tier3_pairwise.test';
import './tier4_application.test';

// ANSI escape codes for formatting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

async function runAllTests(): Promise<void> {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}          internize.ai — Opaque-box E2E Test Suite Runner           ${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  const tests: TestCase[] = registry.tests;
  console.log(`${GRAY}Discovered ${tests.length} tests across 4 test tiers.${RESET}\n`);

  // Group tests by Tier
  const tierOrder = [
    'Tier 1: Feature Coverage',
    'Tier 2: Boundary & Corner Cases',
    'Tier 3: Pairwise Combinations',
    'Tier 4: Real-World Acceptance Benchmarks',
  ];

  const tierSummaries: Record<string, TierSummary> = {};
  for (const t of tierOrder) {
    tierSummaries[t] = {
      tier: t,
      name: t,
      passed: 0,
      failed: 0,
      total: 0,
      durationMs: 0,
      results: [],
    };
  }

  const overallStartTime = Date.now();
  let currentTierName = '';

  for (const t of tests) {
    if (t.tier !== currentTierName) {
      currentTierName = t.tier;
      console.log(`\n${BOLD}${YELLOW}▶ Running ${currentTierName}...${RESET}`);
    }

    if (!tierSummaries[t.tier]) {
      tierSummaries[t.tier] = {
        tier: t.tier,
        name: t.tier,
        passed: 0,
        failed: 0,
        total: 0,
        durationMs: 0,
        results: [],
      };
    }

    const tierSummary = tierSummaries[t.tier];
    tierSummary.total++;

    const start = Date.now();
    let passed = true;
    let testError: Error | undefined;

    try {
      await t.fn();
    } catch (err: any) {
      passed = false;
      testError = err instanceof Error ? err : new Error(String(err));
    }

    const duration = Date.now() - start;
    tierSummary.durationMs += duration;

    if (passed) {
      tierSummary.passed++;
      process.stdout.write(`${GREEN}.${RESET}`);
    } else {
      tierSummary.failed++;
      process.stdout.write(`${RED}F${RESET}`);
      console.error(`\n${RED}✗ [FAIL] ${t.suite} > ${t.name}${RESET}`);
      console.error(`${RED}  ${testError?.message || testError}${RESET}\n`);
    }

    tierSummary.results.push({
      name: t.name,
      suite: t.suite,
      tier: t.tier,
      passed,
      durationMs: duration,
      error: testError,
    });
  }

  const totalDuration = Date.now() - overallStartTime;
  console.log('\n');

  // Display Summary Table
  console.log(`${BOLD}======================================================================${RESET}`);
  console.log(`${BOLD}                       E2E TEST EXECUTION SUMMARY                      ${RESET}`);
  console.log(`${BOLD}======================================================================${RESET}`);
  console.log(
    `${BOLD}${'Tier'.padEnd(42)} ${'Passed'.padStart(8)} ${'Failed'.padStart(8)} ${'Total'.padStart(8)} ${'Time'.padStart(10)} ${'Status'.padStart(8)}${RESET}`,
  );
  console.log('-'.repeat(88));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  for (const t of tierOrder) {
    const summary = tierSummaries[t];
    if (!summary) continue;

    totalPassed += summary.passed;
    totalFailed += summary.failed;
    totalTests += summary.total;

    const statusStr = summary.failed === 0 ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const timeStr = `${(summary.durationMs / 1000).toFixed(2)}s`;

    console.log(
      `${summary.name.padEnd(42)} ${String(summary.passed).padStart(8)} ${String(summary.failed).padStart(8)} ${String(summary.total).padStart(8)} ${timeStr.padStart(10)} ${statusStr.padStart(17)}`,
    );
  }

  console.log('='.repeat(88));
  const overallStatus = totalFailed === 0 ? `${BOLD}${GREEN}ALL PASSED${RESET}` : `${BOLD}${RED}FAILED${RESET}`;
  const totalTimeStr = `${(totalDuration / 1000).toFixed(2)}s`;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

  console.log(
    `${BOLD}${'TOTAL'.padEnd(42)} ${String(totalPassed).padStart(8)} ${String(totalFailed).padStart(8)} ${String(totalTests).padStart(8)} ${totalTimeStr.padStart(10)} ${overallStatus.padStart(17)}${RESET}`,
  );
  console.log(`\nPass Rate: ${BOLD}${passRate}%${RESET} (${totalPassed}/${totalTests} tests)`);
  console.log(`Total Duration: ${totalTimeStr}\n`);

  if (totalFailed > 0) {
    console.error(`${BOLD}${RED}>>> E2E Test Suite FAILED with ${totalFailed} failure(s).${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${BOLD}${GREEN}>>> All E2E test tiers passed successfully!${RESET}\n`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
