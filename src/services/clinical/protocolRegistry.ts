/**
 * internize.ai — Clinical Protocol Template Registry
 *
 * Type definitions and registry lookup for 30+ Sp.PD clinical protocol templates
 * sourced from a real Indonesian teaching hospital's internal medicine training center.
 *
 * 100% on-device, zero-egress, deterministic.
 */

import type { InternalMedicineDivision } from './internalMedicineEngine';

// ──────────────────────────────────────────────────────────────────────────────
// Protocol Category Taxonomy
// ──────────────────────────────────────────────────────────────────────────────

export type ProtocolCategory =
  | 'preop-clearance'
  | 'emergency-protocol'
  | 'drip-titration'
  | 'electrolyte-correction'
  | 'infectious-disease'
  | 'autoimmune'
  | 'scoring-system'
  | 'monitoring'
  | 'perioperative'
  | 'template-form';

export const PROTOCOL_CATEGORY_LABELS: Record<ProtocolCategory, string> = {
  'preop-clearance': 'Kelayakan Pre-Operatif',
  'emergency-protocol': 'Protokol Kegawatan',
  'drip-titration': 'Drip & Titrasi',
  'electrolyte-correction': 'Koreksi Elektrolit',
  'infectious-disease': 'Penyakit Infeksi',
  'autoimmune': 'Autoimun & Reumatologi',
  'scoring-system': 'Sistem Skoring Klinis',
  'monitoring': 'Monitoring & Tindak Lanjut',
  'perioperative': 'Perioperatif',
  'template-form': 'Template & Formulir',
};

// ──────────────────────────────────────────────────────────────────────────────
// Scoring System Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ScoringComponent {
  label?: string;
  name?: string; // alias for label
  value: number | string | null; // null = data not available, number or string if present
  points: number | null; // null = cannot calculate
  description?: string;
}

export interface ScoringResult {
  name: string;
  score?: number | null; // null if insufficient data
  totalScore?: number | null; // optional alias for score
  maxScore?: number;
  interpretation: string;
  riskPercentage?: string;
  components: ScoringComponent[];
  /** Ready-to-paste formatted display text (uses ___ for missing values) */
  displayText: string;
}

export interface ScoringSystemRef {
  name: string;
  calculatorId: string;
  displayFormat: string; // e.g. '{score} points ({risk})'
}

// ──────────────────────────────────────────────────────────────────────────────
// Titration Table Types
// ──────────────────────────────────────────────────────────────────────────────

export interface TitrationTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

// ──────────────────────────────────────────────────────────────────────────────
// Drug Calculation Types
// ──────────────────────────────────────────────────────────────────────────────

export interface CalculationField {
  id: string;
  label: string;
  type?: string;
}

export interface DrugCalculation {
  id?: string;
  title?: string;
  label?: string;
  formula?: string; // Human-readable formula
  unit?: string;
  fields?: CalculationField[];
  /** Deterministic calculator — returns formatted result string or key-value map */
  compute: (params: Record<string, any>) => string | Record<string, string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Protocol Template Interface
// ──────────────────────────────────────────────────────────────────────────────

export interface ProtocolSection {
  heading: string;
  items: string[];
  /** Only show if this pattern matches input text */
  conditional?: string;
  /** True if section contains formulas that need patient-specific data */
  calculable?: boolean;
}

export interface ClinicalProtocolTemplate {
  id: string;
  title: string;
  divisions: InternalMedicineDivision[];
  category: ProtocolCategory;
  /** RegExp for auto-detection from input text */
  keywords: RegExp;
  urgency: 'elective' | 'urgent' | 'cito';

  /** The core template content sections */
  sections: ProtocolSection[];

  /** Optional scoring system(s) attached to this protocol */
  scoringSystems?: ScoringSystemRef[];

  /** Optional titration/dose-rate tables */
  titrationTables?: TitrationTable[];

  /** Optional drug calculation formulas */
  calculations?: DrugCalculation[];

  /** Optional standalone compute function */
  compute?: (params: Record<string, any>) => any;

  /** Source/reference for this protocol */
  source?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Protocol Registry — All protocols registered here
// ──────────────────────────────────────────────────────────────────────────────

const _registry: ClinicalProtocolTemplate[] = [];

/**
 * Register a protocol template into the global registry.
 * Called by individual protocol module files on import.
 */
export function registerProtocol(protocol: ClinicalProtocolTemplate): void {
  // Prevent duplicate registration
  if (!_registry.find((p) => p.id === protocol.id)) {
    _registry.push(protocol);
  }
}

/**
 * Register multiple protocols at once.
 */
export function registerProtocols(protocols: ClinicalProtocolTemplate[]): void {
  for (const p of protocols) {
    registerProtocol(p);
  }
}

/**
 * Get all registered protocols.
 */
export function getAllProtocols(): ClinicalProtocolTemplate[] {
  return [..._registry];
}

/**
 * Match protocols from input text using keyword detection.
 * Returns protocols sorted by relevance (number of keyword matches).
 */
export function matchProtocols(inputText: string): ClinicalProtocolTemplate[] {
  if (!inputText || !inputText.trim()) return [];

  const text = inputText.toLowerCase();
  const matched: Array<{ protocol: ClinicalProtocolTemplate; score: number }> = [];

  for (const protocol of _registry) {
    const m = text.match(protocol.keywords);
    if (m) {
      // Score by number of distinct keyword group matches
      matched.push({ protocol, score: m.length });
    }
  }

  // Sort by relevance (higher score first), then by urgency priority
  const urgencyOrder: Record<string, number> = { cito: 0, urgent: 1, elective: 2 };
  matched.sort((a, b) => {
    const urgDiff =
      (urgencyOrder[a.protocol.urgency] ?? 2) - (urgencyOrder[b.protocol.urgency] ?? 2);
    if (urgDiff !== 0) return urgDiff;
    return b.score - a.score;
  });

  return matched.map((m) => m.protocol);
}

/**
 * Get a specific protocol by its ID.
 */
export function getProtocolById(id: string): ClinicalProtocolTemplate | null {
  return _registry.find((p) => p.id === id) ?? null;
}

/**
 * Format a protocol template into a copy-pasteable plain text draft.
 * Scoring values are left as ___ when not calculable.
 */
export function formatProtocolDraft(protocol: ClinicalProtocolTemplate): string {
  const lines: string[] = [];

  lines.push(`=== ${protocol.title.toUpperCase()} ===`);
  lines.push('');

  // Sections
  for (const section of protocol.sections) {
    lines.push(section.heading);
    for (const item of section.items) {
      lines.push(`  ${item}`);
    }
    lines.push('');
  }

  // Titration Tables
  if (protocol.titrationTables) {
    for (const table of protocol.titrationTables) {
      lines.push(table.title);
      for (const row of table.rows) {
        lines.push(`  ${row.join(' | ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
