import { Check, Copy, Pill } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import type { RxNormConcept } from '../../types/clinical';

export interface RxNormTableProps {
  medications: RxNormConcept[];
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const RxNormTable: React.FC<RxNormTableProps> = ({ medications, onShowToast }) => {
  const [copiedRxcui, setCopiedRxcui] = useState<string | null>(null);

  const handleCopyRxcui = (rxcui: string, name: string) => {
    navigator.clipboard.writeText(rxcui);
    setCopiedRxcui(rxcui);
    setTimeout(() => setCopiedRxcui(null), 2000);
    onShowToast?.(`Copied RxCUI ${rxcui} (${name}) to clipboard`, 'info');
  };

  if (!medications || medications.length === 0) {
    return null;
  }

  return (
    <Card className="border border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Pill className="w-4 h-4 text-purple-600" />
          <CardTitle className="text-xs font-bold text-slate-800">
            RxNorm Medication Reconciliation
          </CardTitle>
          <Badge
            variant="default"
            size="sm"
            className="ml-1 text-[10px] bg-purple-50 text-purple-700 border-purple-200"
          >
            {medications.length} {medications.length === 1 ? 'drug' : 'drugs'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-slate-100">
        {medications.map((med) => {
          const isCopied = copiedRxcui === med.rxcui;

          return (
            <div
              key={med.rxcui}
              className="p-3 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 capitalize">{med.name}</span>
                  {med.dosage && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      {med.dosage}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    TTY: {med.termType}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {med.reconciliationStatus || 'Reconciled'}
                  </span>
                </div>

                {med.scdName ? (
                  <p className="text-[11px] text-slate-600 font-medium">
                    {med.scdName} {med.scdRxcui ? `(SCD ${med.scdRxcui})` : ''}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Ingredient: {med.ttyDisplay || med.name}
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                  {med.route && (
                    <span>
                      Route: <span className="text-slate-600 font-medium">{med.route}</span>
                    </span>
                  )}
                  {med.frequency && (
                    <span>
                      &bull; Sig:{' '}
                      <span className="text-slate-600 font-medium">{med.frequency}</span>
                    </span>
                  )}
                  <span>
                    &bull; Matched:{' '}
                    <span className="font-mono text-slate-600">
                      &ldquo;{med.matchedText}&rdquo;
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyRxcui(med.rxcui, med.name)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono transition-colors border border-slate-200"
                  title="Click to copy RxCUI"
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>RxCUI: {med.rxcui}</span>
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RxNormTable;
