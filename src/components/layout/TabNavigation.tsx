import { clsx } from 'clsx';
import { FileSearch, Settings, Stethoscope } from 'lucide-react';
import type React from 'react';

export type TabId = 'clinical' | 'research' | 'settings';

export interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: 'clinical' as TabId,
      label: 'Penyakit Dalam (Sp.PD)',
      shortLabel: 'Penyakit Dalam',
      icon: Stethoscope,
    },
    {
      id: 'research' as TabId,
      label: 'Research & Extraction',
      shortLabel: 'Research',
      icon: FileSearch,
    },
    {
      id: 'settings' as TabId,
      label: 'Settings',
      shortLabel: 'Config',
      icon: Settings,
    },
  ];

  return (
    <nav className="bg-slate-100/90 p-1 rounded-xl mx-4 my-2 border border-slate-200/80 shadow-inner flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-150',
              isActive
                ? 'bg-maroon-900 text-gold-300 shadow-sm border border-gold-600/50'
                : 'text-slate-600 hover:text-maroon-900 hover:bg-slate-200/60',
            )}
          >
            <Icon
              className={clsx(
                'w-3.5 h-3.5 shrink-0',
                isActive ? 'text-gold-400' : 'text-slate-400',
              )}
            />
            <span className="truncate">{tab.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
};
