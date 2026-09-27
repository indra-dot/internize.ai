import type React from 'react';
import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { type TabId, TabNavigation } from '../components/layout/TabNavigation';
import { Toast, type ToastType } from '../components/ui/Toast';
import { ClinicalServiceTab } from '../features/clinical/ClinicalServiceTab';
import { ResearchExtractionTab } from '../features/research/ResearchExtractionTab';
import { SettingsTab } from '../features/settings/SettingsTab';
import { useSelection } from './hooks/useSelection';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('clinical');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { selection, pullActiveTabSelection } = useSelection();

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 select-text">
      {/* Extension Header */}
      <Header onDeviceMode="ready" />

      {/* Primary Navigation Tabs */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed top-12 left-4 right-4 z-50 space-y-2 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast
                type={toast.type}
                message={toast.message}
                onClose={() => removeToast(toast.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Active Tab View */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'clinical' && (
          <ClinicalServiceTab initialText={selection.text} onShowToast={showToast} />
        )}
        {activeTab === 'research' && (
          <ResearchExtractionTab initialText={selection.text} onShowToast={showToast} />
        )}
        {activeTab === 'settings' && <SettingsTab onShowToast={showToast} />}
      </main>

      {/* Bottom System Status Bar */}
      <StatusBar
        hasSelection={Boolean(selection.text)}
        sourceUrl={selection.sourceUrl}
        sourceTitle={selection.title}
        onSyncClick={pullActiveTabSelection}
      />
    </div>
  );
};

export default App;
