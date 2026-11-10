import type React from 'react';
import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { type TabId, TabNavigation } from '../components/layout/TabNavigation';
import { ByokFirstModal } from '../components/ui/ByokFirstModal';
import { InstallGuideModal } from '../components/ui/InstallGuideModal';
import { OnboardingTourModal } from '../components/ui/OnboardingTourModal';
import { Toast, type ToastType } from '../components/ui/Toast';
import { UpdateNotificationBanner } from '../components/ui/UpdateNotificationBanner';
import { ClinicalServiceTab } from '../features/clinical/ClinicalServiceTab';
import { SettingsTab } from '../features/settings/SettingsTab';
import { loadGeminiConfig } from '../services/gemini/client';
import { clearAllPatientSessions } from '../services/storage/chromeStorage';
import {
  CURRENT_APP_VERSION,
  checkForUpdate,
  dismissUpdate,
  isUpdateDismissed,
  type VersionInfo,
} from '../services/updateChecker';
import { useSelection } from './hooks/useSelection';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('clinical');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showByokModal, setShowByokModal] = useState<boolean>(false);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [sampleLoadTrigger, setSampleLoadTrigger] = useState<number>(0);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const { selection, pullActiveTabSelection } = useSelection();

  // Initial check: BYOK First check & Onboarding tour check
  useEffect(() => {
    loadGeminiConfig().then((config) => {
      const hasKey = Boolean(config?.apiKey);
      setHasApiKey(hasKey);

      if (!hasKey) {
        // BYOK first: if no key is configured and not dismissed this session, prompt immediately at start
        let dismissed = false;
        try {
          dismissed = Boolean(sessionStorage.getItem('byok_prompt_dismissed'));
        } catch {}
        if (!dismissed) {
          setShowByokModal(true);
          return;
        }
      }

      // If BYOK is already configured or dismissed, check onboarding tour
      try {
        const tourDone = localStorage.getItem('hasCompletedTour_v2_1');
        if (!tourDone) {
          setShowTour(true);
        }
      } catch {}
    });
  }, []);

  // PWA Install Prompt & Service Worker Update Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setSwUpdateAvailable(true);
            }
          });
        });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Periodic Update Manifest Checker (/version.json)
  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      try {
        const result = await checkForUpdate(CURRENT_APP_VERSION);
        if (!isMounted) return;
        if (result.updateAvailable && result.versionInfo) {
          if (!isUpdateDismissed(result.latestVersion)) {
            setUpdateInfo(result.versionInfo);
          }
        }
      } catch {
        // Silently catch network errors during offline / disconnected mode
      }
    };

    runCheck();
    const interval = setInterval(runCheck, 30 * 60 * 1000); // 30 minutes
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    try {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
    } catch {
      setDeferredInstallPrompt(null);
    }
  };

  const handleCloseByokModal = () => {
    setShowByokModal(false);
    try {
      sessionStorage.setItem('byok_prompt_dismissed', 'true');
    } catch {}
    // If onboarding tour hasn't been shown yet, trigger it now
    try {
      const tourDone = localStorage.getItem('hasCompletedTour_v2_1');
      if (!tourDone) {
        setShowTour(true);
      }
    } catch {}
  };

  const handleByokSuccess = () => {
    setHasApiKey(true);
    showToast('Google Gemini API Key berhasil diaktifkan (BYOK)!', 'success');
  };

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
        hasApiKey={hasApiKey}
        onByokClick={() => setShowByokModal(true)}
        onHelpClick={() => setShowTour(true)}
        onInstallGuideClick={() => setShowInstallGuide(true)}
        onClearSessionClick={handleClearSession}
      />

      {/* Extension Update Notification Banner */}
      {updateInfo && (
        <UpdateNotificationBanner
          versionInfo={updateInfo}
          currentVersion={CURRENT_APP_VERSION}
          onOpenGuide={() => setShowInstallGuide(true)}
          onDismiss={() => {
            dismissUpdate(updateInfo.version);
            setUpdateInfo(null);
          }}
        />
      )}

      {/* PWA Auto-Update / Install Notification Bar */}
      {(swUpdateAvailable || deferredInstallPrompt) && (
        <div className="bg-amber-950 text-amber-100 px-4 py-1.5 text-xs flex items-center justify-between border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            {swUpdateAvailable ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span>Pembaruan aplikasi Internize.ai tersedia!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Pasang Internize.ai sebagai Aplikasi Lokal (Offline-First PWA)</span>
              </>
            )}
          </div>
          {swUpdateAvailable ? (
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
            >
              Muat Ulang Sekarang
            </button>
          ) : (
            <button
              onClick={handleInstallPwa}
              className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
            >
              Install Aplikasi
            </button>
          )}
        </div>
      )}

      {/* Primary Navigation Tabs: Clinical & Settings (Research removed to focus 100% on clinical Sp.PD) */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed top-12 left-4 right-4 z-50 space-y-2 pointer-events-none max-w-xl mx-auto">
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

      {/* BYOK First Setup Modal (Shown at start if no API Key configured) */}
      <ByokFirstModal
        isOpen={showByokModal}
        onClose={handleCloseByokModal}
        onSuccess={handleByokSuccess}
        onShowToast={showToast}
      />

      {/* Onboarding Tour Modal */}
      <OnboardingTourModal
        isOpen={showTour}
        onClose={handleCloseTour}
        onStartSampleCase={handleStartSampleCase}
        onSelectSampleCase={handleStartSampleCase}
      />

      {/* Visual 3-Step Install & Update Guide Modal */}
      <InstallGuideModal
        isOpen={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        downloadUrl={updateInfo?.downloadUrl || '/internize-ai-extension.zip'}
      />

      {/* Active Tab View: Purely Clinical & Settings */}
      <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto">
        {activeTab === 'clinical' && (
          <ClinicalServiceTab
            initialText={selection.text}
            onShowToast={showToast}
            sampleLoadTrigger={sampleLoadTrigger}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenByokModal={() => setShowByokModal(true)}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            onShowToast={showToast}
            onOpenInstallGuide={() => setShowInstallGuide(true)}
          />
        )}
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
