import { Check, Copy, Tag } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import type { SnomedConcept } from '../../types/clinical';

export interface SnomedTableProps {
  concepts: SnomedConcept[];
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SnomedTable: React.FC<SnomedTableProps> = ({ concepts, onShowToast }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string, term: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    onShowToast?.(`Copied SCTID ${code} (${term}) to clipboard`, 'info');
  };

  if (!concepts || concepts.length === 0) {
    return null;
  }

  return (
    <Card className="border border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-sky-600" />
          <CardTitle className="text-xs font-bold text-slate-800">SNOMED CT Diagnoses</CardTitle>
          <Badge variant="primary" size="sm" className="ml-1 text-[10px]">
            {concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-slate-100">
        {concepts.map((concept) => {
          const isCopied = copiedCode === concept.code;
          const confPercent = Math.round(concept.confidence * 100);

          return (
            <div
              key={concept.code}
              className="p-3 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900 leading-tight">
                    {concept.preferredTerm}
                  </span>
                  {concept.hierarchy && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {concept.hierarchy}
                    </span>
                  )}
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                    {confPercent}% match
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 truncate" title={concept.display}>
                  {concept.fsn || concept.display}
                </p>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>Matched text:</span>
                  <span className="font-medium text-slate-600 bg-slate-100 px-1 rounded">
                    &ldquo;{concept.matchedText}&rdquo;
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyCode(concept.code, concept.preferredTerm)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono transition-colors border border-slate-200"
                  title="Click to copy SCTID"
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>SCTID: {concept.code}</span>
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SnomedTable;
