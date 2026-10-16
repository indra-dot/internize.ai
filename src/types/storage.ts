import type { SupabaseConfig } from './research';

export interface UserPreferences {
  autoReceiveHighlight: boolean;
  defaultTab: 'clinical' | 'research';
  enableHardwareAcceleration: boolean;
}

export interface SyncStorageSchema {
  /**
   * @deprecated Migrated to LocalStorageSchema in v2.1.0 to prevent cloud credential sync.
   * Kept optional for backward-compatible fallback during migration.
   */
  supabaseConfig?: SupabaseConfig;
  userPreferences?: UserPreferences;
}

export interface ClinicalDraft {
  inputText: string;
  lastUpdated: number;
}

export interface ResearchDraft {
  rawText: string;
  lastUpdated: number;
}

export interface LocalStorageSchema {
  clinicalDraft?: ClinicalDraft;
  researchDraft?: ResearchDraft;
  supabaseConfig?: SupabaseConfig;
}
