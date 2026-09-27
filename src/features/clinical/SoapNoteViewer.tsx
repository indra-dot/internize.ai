import { Check, Copy, Download, MousePointerClick, Stethoscope } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { insertTextToActiveField } from '../../services/emr/fieldInjector';
import type { SoapNote } from '../../types/clinical';

export interface SoapNoteViewerProps {
  soapNote: SoapNote;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SoapNoteViewer: React.FC<SoapNoteViewerProps> = ({ soapNote, onShowToast }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedFull, setCopiedFull] = useState<boolean>(false);
  const [insertedSection, setInsertedSection] = useState<string | null>(null);

  const sections = [
    {
      key: 'subjective' as const,
      section: soapNote.subjective,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      pillColor: 'text-blue-700',
      code: 'S',
    },
    {
      key: 'objective' as const,
      section: soapNote.objective,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pillColor: 'text-emerald-700',
      code: 'O',
    },
    {
      key: 'assessment' as const,
      section: soapNote.assessment,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      pillColor: 'text-purple-700',
      code: 'A',
    },
    {
      key: 'plan' as const,
      section: soapNote.plan,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      pillColor: 'text-amber-700',
      code: 'P',
    },
  ];

  const formatFullNoteMarkdown = (): string => {
    return [
      '# Draf Catatan SOAP Klinis (Sp.PD)',
      `*Dibuat: ${new Date(soapNote.generatedAt).toLocaleString('id-ID')}*`,
      '',
      '## Subjective (S)',
      ...soapNote.subjective.content.map((c) => `- ${c}`),
      '',
      '## Objective (O)',
      ...soapNote.objective.content.map((c) => `- ${c}`),
      '',
      '## Assessment (A)',
      ...soapNote.assessment.content.map((c) => `- ${c}`),
      '',
      '## Plan (P)',
      ...soapNote.plan.content.map((c) => `- ${c}`),
    ].join('\n');
  };

  const handleCopySection = (key: string, title: string, content: string[]) => {
    const text = content.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
    onShowToast?.(`Copied ${title} section to clipboard`, 'info');
  };

  const handleInsertToEmr = async (key: string, title: string, content: string[]) => {
    const text = `${title}:\n${content.map((c) => `• ${c}`).join('\n')}`;
    const result = await insertTextToActiveField(text);
    if (result.success) {
      setInsertedSection(key);
      setTimeout(() => setInsertedSection(null), 2500);
      onShowToast?.(`Seksi ${title} berhasil dimasukkan ke field EMR`, 'success');
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text).catch(() => {});
      onShowToast?.(result.error ?? 'Gagal inject ke EMR. Teks disalin ke clipboard.', 'warning');
    }
  };

  const handleCopyFull = () => {
    const markdown = formatFullNoteMarkdown();
    navigator.clipboard.writeText(markdown);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
    onShowToast?.('Copied complete SOAP note to clipboard', 'success');
  };

  const handleDownloadMarkdown = () => {
    const markdown = formatFullNoteMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soap_note_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast?.('Downloaded SOAP note as Markdown', 'success');
  };

  return (
    <Card className="border border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Stethoscope className="w-4 h-4 text-emerald-600" />
          <CardTitle className="text-xs font-bold text-slate-800">Draf Catatan SOAP Terstruktur</CardTitle>
          <Badge variant="success" size="sm" className="ml-1 text-[10px]">
            Bebas Halusinasi
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyFull}
            className="h-7 px-2 text-[11px] gap-1 text-slate-600 hover:text-slate-900"
            title="Salin seluruh draf SOAP ke clipboard"
          >
            {copiedFull ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFull ? 'Tersalin' : 'Salin Draf'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadMarkdown}
            className="h-7 px-2 text-[11px] gap-1 text-slate-600 hover:text-slate-900"
            title="Unduh draf sebagai file Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {sections.map(({ key, section, badgeColor, pillColor, code }) => {
          const isCopied = copiedSection === key;
          const isInserted = insertedSection === key;
          const hasContent = section.content && section.content.length > 0;

          return (
            <div
              key={key}
              className="bg-white rounded-lg p-2.5 border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-slate-300"
            >
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold border ${badgeColor}`}
                  >
                    {code}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${pillColor}`}>
                    {section.title}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {/* Insert to EMR button */}
                  <button
                    type="button"
                    onClick={() => handleInsertToEmr(key, section.title, section.content)}
                    className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                      isInserted
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title={`Insert ${section.title} into active EMR field`}
                  >
                    {isInserted ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <MousePointerClick className="w-3 h-3" />
                    )}
                    <span>{isInserted ? 'OK' : 'EMR'}</span>
                  </button>
                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={() => handleCopySection(key, section.title, section.content)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                    title={`Copy ${section.title} section`}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed font-sans">
                {hasContent ? (
                  section.content.map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                      return <div key={`${key}-${idx}-empty`} className="h-1" />;
                    }

                    const isSubheader =
                      trimmed.startsWith('---') ||
                      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                      (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('-') && !trimmed.startsWith('•'));

                    if (isSubheader) {
                      return (
                        <div
                          key={`${key}-${idx}-${trimmed.slice(0, 15)}`}
                          className="pt-1.5 pb-0.5 font-bold text-slate-900 text-[11px] tracking-wide"
                        >
                          {trimmed.replace(/^---\s*|\s*---$/g, '')}
                        </div>
                      );
                    }

                    const isBullet = trimmed.startsWith('-') || trimmed.startsWith('•') || /^\d+\.\s/.test(trimmed);

                    return (
                      <div
                        key={`${key}-${idx}-${trimmed.slice(0, 15)}`}
                        className={`flex items-start gap-1.5 ${isBullet ? 'pl-1' : ''}`}
                      >
                        {!isBullet && <span className="text-slate-400 select-none mt-0.5">&bull;</span>}
                        <div className="flex-1 break-words">
                          <span>{trimmed}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic text-[11px]">None reported.</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SoapNoteViewer;
