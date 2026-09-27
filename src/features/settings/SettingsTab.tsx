import { CheckCircle, Database, Save, Wifi, XCircle } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { testSupabaseConnection } from '../../services/supabase/client';
import type { SupabaseConfig } from '../../types/research';

export interface SettingsTabProps {
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

export const SettingsTab: React.FC<SettingsTabProps> = ({ onShowToast }) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [tableName, setTableName] = useState<string>('fhir_bundles');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string>('');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.get(['supabaseConfig'], (result) => {
        const config = result.supabaseConfig as SupabaseConfig | undefined;
        if (config) {
          setSupabaseUrl(config.url || '');
          setSupabaseAnonKey(config.anonKey || '');
          setTableName(config.tableName || 'fhir_bundles');
        }
      });
    }
  }, []);

  const handleSave = () => {
    const config: SupabaseConfig = {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      tableName: tableName.trim() || 'fhir_bundles',
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set({ supabaseConfig: config }, () => {
        setIsSaved(true);
        setConnectionStatus('idle');
        setTimeout(() => setIsSaved(false), 2000);
        onShowToast?.('Supabase settings saved to chrome.storage.sync', 'success');
      });
    } else {
      setIsSaved(true);
      setConnectionStatus('idle');
      setTimeout(() => setIsSaved(false), 2000);
      onShowToast?.('Settings saved locally', 'success');
    }
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      onShowToast?.('Enter Supabase URL and anon key before testing.', 'warning');
      return;
    }
    setConnectionStatus('testing');
    setConnectionError('');
    const result = await testSupabaseConnection({
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      tableName: tableName.trim() || 'fhir_bundles',
    });
    if (result.success) {
      setConnectionStatus('ok');
      onShowToast?.('Supabase connection successful!', 'success');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.error ?? 'Unknown error');
      onShowToast?.(`Connection failed: ${result.error}`, 'error');
    }
  };

  return (
    <div className="space-y-4 px-4 pb-6">
      <Card>
        <CardHeader className="py-2.5">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-purple-600" />
            <CardTitle>Supabase Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="supabase-url" className="text-xs font-semibold text-slate-700">
              Supabase Project URL
            </label>
            <input
              id="supabase-url"
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="supabase-anon-key" className="text-xs font-semibold text-slate-700">
              Supabase Anon Key
            </label>
            <input
              id="supabase-anon-key"
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="supabase-table-name" className="text-xs font-semibold text-slate-700">
              Target Table Name
            </label>
            <input
              id="supabase-table-name"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="fhir_bundles"
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>

          {/* Connection status feedback */}
          {connectionStatus === 'ok' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Connection successful</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 rounded-lg p-2">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="break-all">{connectionError}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={connectionStatus === 'testing'}
              onClick={handleTestConnection}
              className="flex-1 gap-1.5 text-xs"
            >
              <Wifi className="w-3.5 h-3.5 text-sky-600" />
              <span>Test Connection</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              className="flex-1 gap-1.5 bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
            >
              {isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? 'Saved!' : 'Save'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy notice */}
      <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1">
        <p className="font-semibold text-slate-500">🔒 Privacy notice</p>
        <p>
          All AI inference runs 100% on-device (WebGPU/WASM). Supabase is only contacted when you
          explicitly push a de-identified FHIR Bundle. Raw patient text never leaves your browser.
        </p>
      </div>
    </div>
  );
};
