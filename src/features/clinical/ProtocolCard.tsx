import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Flame,
  MousePointerClick,
  Sliders,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { getProtocolSources } from '../../services/clinical/guidelineSources';
import type { ClinicalProtocolTemplate } from '../../services/clinical/protocolRegistry';
import { formatProtocolDraft } from '../../services/clinical/protocolRegistry';
import { insertTextToActiveField } from '../../services/emr/fieldInjector';

interface ProtocolCardProps {
  protocol: ClinicalProtocolTemplate;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  defaultExpanded?: boolean;
}

export const ProtocolCard: React.FC<ProtocolCardProps> = ({
  protocol,
  onShowToast,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [injected, setInjected] = useState(false);

  const handleCopy = () => {
    const text = formatProtocolDraft(protocol);
    navigator.clipboard.writeText(text);
    setCopied(true);
    onShowToast?.(`Protokol "${protocol.title}" berhasil disalin!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInject = async () => {
    const text = formatProtocolDraft(protocol);
    const res = await insertTextToActiveField(text);
    if (res.success) {
      setInjected(true);
      onShowToast?.(`Protokol "${protocol.title}" dimasukkan ke EMR`, 'success');
      setTimeout(() => setInjected(false), 2000);
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      onShowToast?.(
        res.error ?? 'Gagal inject otomatis. Draf protokol telah disalin ke clipboard.',
        'warning',
      );
    }
  };

  const getUrgencyBadge = () => {
    switch (protocol.urgency) {
      case 'cito':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <Flame className="w-3 h-3 text-rose-600 animate-pulse" />
            CITO
          </span>
        );
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            URGENT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            ELEKTIF
          </span>
        );
    }
  };

  return (
    <Card className="border border-slate-200/90 shadow-sm hover:border-gold-400/60 transition-all duration-200 bg-white overflow-hidden">
      {/* Header bar */}
      <div
        className="px-3.5 py-2.5 bg-slate-50/80 hover:bg-slate-100/70 cursor-pointer flex items-center justify-between border-b border-slate-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <BookOpen className="w-4 h-4 text-maroon-800 shrink-0" />
          <h4 className="text-xs font-semibold text-slate-900 truncate">
            {protocol.title}
          </h4>
          {getUrgencyBadge()}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-slate-500 hover:text-maroon-800"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            title="Salin teks protokol"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="p-3.5 space-y-3 text-xs text-slate-700">
          {/* Sections */}
          {protocol.sections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <span className="font-semibold text-maroon-900 text-[11px] block">
                {sec.heading}
              </span>
              <ul className="space-y-1 pl-1">
                {sec.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-gold-600 font-bold select-none shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Titration Tables */}
          {protocol.titrationTables && protocol.titrationTables.length > 0 && (
            <div className="space-y-2 pt-1">
              {protocol.titrationTables.map((tbl, tblIdx) => (
                <div key={tblIdx} className="rounded border border-slate-200 overflow-hidden bg-slate-50/50">
                  <div className="px-2.5 py-1 bg-slate-100 font-semibold text-[11px] text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-maroon-700" />
                    <span>{tbl.title}</span>
                  </div>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-slate-200/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          {tbl.headers.map((h, hIdx) => (
                            <th key={hIdx} className="px-2.5 py-1">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {tbl.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-amber-50/40">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-2.5 py-1 text-slate-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2.5 gap-1.5 text-slate-700 hover:border-gold-500"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin Draf</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="primary"
              className="h-7 text-[11px] px-2.5 gap-1.5 bg-maroon-800 hover:bg-maroon-900 text-white"
              onClick={handleInject}
            >
              {injected ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Dimasukkan</span>
                </>
              ) : (
                <>
                  <MousePointerClick className="w-3 h-3" />
                  <span>Inject ke EMR</span>
                </>
              )}
            </Button>
          </div>

          <div className="pt-2 border-t border-slate-200 text-[10.5px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600">Sumber rujukan:</p>
            {getProtocolSources(protocol).map((src) => (
              <p key={src.id} className="leading-relaxed">
                {src.citation}
                {src.url && (
                  <>
                    {' '}
                    <a href={src.url} target="_blank" rel="noreferrer" className="text-maroon-800 underline">
                      tautan
                    </a>
                  </>
                )}
                {src.status === 'partial' && src.note && (
                  <span className="italic text-amber-700"> ({src.note})</span>
                )}
              </p>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
