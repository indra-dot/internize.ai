import type { SupabaseConfig } from './research';

export interface UserPreferences {
  autoReceiveHighlight: boolean;
  defaultTab: 'clinical' | 'research';
  enableHardwareAcceleration: boolean;
}

export interface SyncStorageSchema {
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
}
