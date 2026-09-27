/**
 * extractor.ts
 * LOINC lab biomarker extractor.
 * Scans narrative text for known lab analytes using the LOINC dictionary,
 * extracts numeric values and units, and derives abnormal flags.
 * Zero network calls — fully on-device.
 */

import type { LabFlag, LoincLabRecord } from '../../types/research';
import { LOINC_DICTIONARY } from './loincDictionary';

/**
 * Derives a flag ('low' | 'normal' | 'high' | 'critical') based on
 * the numeric value and the entry's reference thresholds.
 */
function deriveFlag(value: number, low: number | undefined, high: number | undefined): LabFlag {
  if (high !== undefined && value > high * 1.5) return 'critical';
  if (high !== undefined && value > high) return 'high';
  if (low !== undefined && value < low * 0.5) return 'critical';
  if (low !== undefined && value < low) return 'low';
  return 'normal';
}

/**
 * Extracts all recognizable lab biomarkers from the provided text,
 * mapping each to its LOINC code, value, unit, and abnormal flag.
 *
 * @param text  The narrative text to scan (ideally already de-identified).
 * @returns     Array of structured LOINC lab records.
 */
export function extractLabBiomarkers(text: string): LoincLabRecord[] {
  const results: LoincLabRecord[] = [];
  const seenCodes = new Set<string>();

  for (const entry of LOINC_DICTIONARY) {
    // Reset lastIndex for each dictionary entry
    entry.valuePattern.lastIndex = 0;

    let match = entry.valuePattern.exec(text);
    while (match !== null) {
      const rawValue = match[1];
      const numericValue = rawValue ? Number.parseFloat(rawValue) : Number.NaN;

      if (!Number.isNaN(numericValue) && !seenCodes.has(entry.loincCode)) {
        const flag = deriveFlag(numericValue, entry.low, entry.high);
        results.push({
          testName: entry.testName,
          loincCode: entry.loincCode,
          value: numericValue,
          unit: entry.ucumUnit,
          referenceRange: entry.referenceRange,
          flag,
        });
        seenCodes.add(entry.loincCode);
      }

      if (seenCodes.has(entry.loincCode)) break;
      match = entry.valuePattern.exec(text);
    }
  }

  // Sort: critical first, then high, then low, then normal
  const flagOrder: Record<LabFlag, number> = {
    critical: 0,
    high: 1,
    low: 2,
    normal: 3,
  };
  results.sort((a, b) => flagOrder[a.flag ?? 'normal'] - flagOrder[b.flag ?? 'normal']);

  return results;
}
