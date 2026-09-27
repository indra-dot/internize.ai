import { Lock, MousePointerClick } from 'lucide-react';
import type React from 'react';

export interface StatusBarProps {
  hasSelection?: boolean;
  sourceUrl?: string;
  sourceTitle?: string;
  onSyncClick?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hasSelection = false,
  sourceTitle,
  onSyncClick,
}) => {
  return (
    <footer className="sticky bottom-0 z-20 bg-maroon-950 text-slate-300 text-[11px] px-3 py-1.5 border-t border-maroon-900 flex items-center justify-between gap-2 shadow-lg">
      <div className="flex items-center gap-1.5 truncate">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        {hasSelection ? (
          <span className="text-gold-300 truncate font-medium">
            Active selection {sourceTitle ? `(${sourceTitle})` : ''}
          </span>
        ) : (
          <span className="text-slate-400 truncate">
            Ready &bull; Highlight text on page to capture
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onSyncClick && (
          <button
            type="button"
            onClick={onSyncClick}
            className="flex items-center gap-1 text-[10px] text-gold-400 hover:text-gold-300 hover:underline transition-colors"
            title="Pull selection from active tab"
          >
            <MousePointerClick className="w-3 h-3" />
            <span>Sync Tab</span>
          </button>
        )}
        <div className="flex items-center gap-1 text-[10px] text-slate-400 border-l border-maroon-800 pl-2">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Zero PHI Egress</span>
        </div>
      </div>
    </footer>
  );
};
