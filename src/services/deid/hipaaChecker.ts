/**
 * hipaaChecker.ts
 * Evaluates a de-identification result against HIPAA Safe Harbor criteria
 * and computes a structured compliance report.
 */

import type { DeidEntity, HipaaComplianceResult } from '../../types/research';

// The 18 Safe Harbor identifier categories from 45 CFR §164.514(b)(2)
const SAFE_HARBOR_REQUIRED_CATEGORIES = new Set([
  'NAME',
  'ADDRESS',
  'ZIP',
  'DATE',
  'PHONE',
  'FAX',
  'EMAIL',
  'SSN',
  'MRN',
  'HEALTH_PLAN_ID',
  'ACCOUNT_NUMBER',
  'LICENSE_NUMBER',
  'VEHICLE_ID',
  'DEVICE_ID',
  'URL',
  'IP_ADDRESS',
  'BIOMETRIC',
  'IMAGE_REF',
]);

// High-risk patterns that, if still found in the redacted text, indicate a leak
const RESIDUAL_RISK_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/, // Date
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  /\bMRN[:.\s#]+\d{4,10}\b/i, // MRN
];

export interface HipaaAuditDetail {
  categoriesFound: string[];
  categoriesRedacted: string[];
  coveragePercent: number;
  criticalLeaks: string[];
}

export interface HipaaFullResult extends HipaaComplianceResult {
  audit: HipaaAuditDetail;
}

/**
 * Evaluates whether the de-identification output meets HIPAA Safe Harbor.
 *
 * @param redactedText  The output text after de-identification.
 * @param entities      The list of entities that were detected and removed.
 */
export function checkHipaaCompliance(
  redactedText: string,
  entities: DeidEntity[],
): HipaaFullResult {
  const categoriesFound = [...new Set(entities.map((e) => e.category))];
  const categoriesRedacted = categoriesFound.filter((c) => SAFE_HARBOR_REQUIRED_CATEGORIES.has(c));

  // Check for residual PHI in the redacted text
  const criticalLeaks: string[] = [];
  for (const pattern of RESIDUAL_RISK_PATTERNS) {
    if (pattern.test(redactedText)) {
      criticalLeaks.push(pattern.toString());
    }
  }

  const coveragePercent =
    categoriesFound.length === 0
      ? 100
      : Math.round((categoriesRedacted.length / categoriesFound.length) * 100);

  const safeHarborMet = criticalLeaks.length === 0 && coveragePercent === 100;
  const compliant = safeHarborMet;

  let residualRisk: HipaaComplianceResult['residualRisk'] = 'low';
  if (criticalLeaks.length > 2 || coveragePercent < 70) {
    residualRisk = 'high';
  } else if (criticalLeaks.length > 0 || coveragePercent < 90) {
    residualRisk = 'moderate';
  }

  return {
    compliant,
    safeHarborMet,
    residualRisk,
    redactedCount: entities.length,
    unredactedSuspects: criticalLeaks.length,
    timestamp: new Date().toISOString(),
    audit: {
      categoriesFound,
      categoriesRedacted,
      coveragePercent,
      criticalLeaks,
    },
  };
}
