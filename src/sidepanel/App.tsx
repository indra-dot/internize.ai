import type React from 'react';
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { type TabId, TabNavigation } from '../components/layout/TabNavigation';
import { OnboardingTourModal } from '../components/ui/OnboardingTourModal';
import { Toast, type ToastType } from '../components/ui/Toast';
import { ClinicalServiceTab } from '../features/clinical/ClinicalServiceTab';
import { ResearchExtractionTab } from '../features/research/ResearchExtractionTab';
import { SettingsTab } from '../features/settings/SettingsTab';
import { clearAllPatientSessions } from '../services/storage/chromeStorage';
import { useSelection } from './hooks/useSelection';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('clinical');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [sampleLoadTrigger, setSampleLoadTrigger] = useState<number>(0);
  const { selection, pullActiveTabSelection } = useSelection();

  // First-time onboarding check for Internize 2.1
  useEffect(() => {
    try {
      const tourDone = localStorage.getItem('hasCompletedTour_v2_1');
      if (!tourDone) {
        setShowTour(true);
      }
    } catch {
      // Fallback if localStorage is restricted
    }
  }, []);

  const handleCloseTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem('hasCompletedTour_v2_1', 'true');
    } catch {
      // ignore
    }
  };

  const handleStartSampleCase = () => {
    handleCloseTour();
    setActiveTab('clinical');
    setSampleLoadTrigger((prev) => prev + 1);
  };

  const handleClearSession = async () => {
    await clearAllPatientSessions();
    showToast('Sesi pasien berhasil dibersihkan. Memori lokal kosong.', 'info');
    // Trigger reset without hard page reload
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

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
      <Header
        onDeviceMode="ready"
        onHelpClick={() => setShowTour(true)}
        onClearSessionClick={handleClearSession}
      />

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

      {/* Onboarding Tour Modal */}
      <OnboardingTourModal
        isOpen={showTour}
        onClose={handleCloseTour}
        onStartSampleCase={handleStartSampleCase}
        onSelectSampleCase={handleStartSampleCase}
      />

      {/* Active Tab View */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'clinical' && (
          <ClinicalServiceTab
            initialText={selection.text}
            onShowToast={showToast}
            sampleLoadTrigger={sampleLoadTrigger}
          />
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
