import { ArrowRight, Download, FileText, ShieldCheck, TestTube, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { assembleFhirBundle, downloadBundleAsJson } from '../../services/fhir/assembler';
import { extractLabBiomarkers } from '../../services/loinc/extractor';
import { loadResearchDraft, saveResearchDraft } from '../../services/storage/chromeStorage';
import type { FhirBundle } from '../../types/fhir';
import type { DeidEntity, HipaaComplianceResult, LoincLabRecord } from '../../types/research';

// Lazy-import the deid services to avoid blocking initial render
async function runDeid(text: string) {
  const [{ deidentifyText }, { checkHipaaCompliance }] = await Promise.all([
    import('../../services/deid/deidentifier'),
    import('../../services/deid/hipaaChecker'),
  ]);
  const deidResult = deidentifyText(text);
  const hipaaResult = checkHipaaCompliance(deidResult.redactedText, deidResult.entities);
  return { ...deidResult, hipaaResult };
}

export interface ResearchExtractionTabProps {
  initialText?: string;
  onTextChange?: (text: string) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const SAMPLE_RESEARCH_TEXT =
  'Patient John Smith, DOB 01/15/1980, MRN 123456. Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL.';

export const ResearchExtractionTab: React.FC<ResearchExtractionTabProps> = ({
  initialText = '',
  onTextChange,
  onShowToast,
}) => {
  const [rawText, setRawText] = useState<string>(initialText);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [deidentifiedText, setDeidentifiedText] = useState<string | null>(null);
  const [entities, setEntities] = useState<DeidEntity[]>([]);
  const [hipaaResult, setHipaaResult] = useState<HipaaComplianceResult | null>(null);
  const [labRecords, setLabRecords] = useState<LoincLabRecord[]>([]);
  const [assembledBundle, setAssembledBundle] = useState<FhirBundle | null>(null);

  React.useEffect(() => {
    if (initialText) {
      setRawText(initialText);
      return;
    }
    loadResearchDraft().then((draft) => {
      if (draft) setRawText(draft);
    });
  }, [initialText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    onTextChange?.(val);
    saveResearchDraft(val);
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_RESEARCH_TEXT);
    onTextChange?.(SAMPLE_RESEARCH_TEXT);
    onShowToast?.('Loaded sample research narrative with PHI and labs', 'info');
  };

  const handleClear = () => {
    setRawText('');
    setDeidentifiedText(null);
    setEntities([]);
    setHipaaResult(null);
    setLabRecords([]);
    setAssembledBundle(null);
    onTextChange?.('');
  };

  const handleProcessDeid = async () => {
    if (!rawText.trim()) {
      onShowToast?.('Please enter raw clinical/research text first', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. De-identify + HIPAA check
      const { redactedText, entities: detected, hipaaResult: hipaa } = await runDeid(rawText);

      // 2. LOINC lab extraction (run on de-identified text)
      const labs = extractLabBiomarkers(redactedText);

      // 3. Assemble FHIR Bundle
      const { bundle } = assembleFhirBundle(labs);

      setDeidentifiedText(redactedText);
      setEntities(detected);
      setHipaaResult(hipaa);
      setLabRecords(labs);
      setAssembledBundle(bundle);

      onShowToast?.(
        `De-identified ${detected.length} identifier(s). Found ${labs.length} lab record(s).`,
        hipaa.compliant ? 'success' : 'warning',
      );
    } catch (err) {
      console.error('Research processing error:', err);
      onShowToast?.('Processing error — check console for details.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadFhir = () => {
    if (!assembledBundle) return;
    downloadBundleAsJson(assembledBundle);
    onShowToast?.('Downloaded FHIR R4 Transaction Bundle JSON', 'success');
  };

  const handleDownloadTxt = () => {
    if (!deidentifiedText && labRecords.length === 0) return;

    const divider = '='.repeat(64);
    const subDivider = '-'.repeat(64);

    const reportLines = [
      divider,
      'INTERNIZE.AI — RESEARCH CLINICAL EXTRACTION REPORT',
      `Tanggal Ekstraksi: ${new Date().toLocaleString('id-ID')}`,
      `Status Kepatuhan HIPAA: ${hipaaResult?.compliant ? 'COMPLIANT (Safe Harbor 18 Categories)' : 'NON-COMPLIANT'}`,
      `Entitas Ter-Sanitasi: ${entities.length} identitas diganti token`,
      divider,
      '',
      '1. AUDIT TRAIL ENTITAS TER-SANITASI (TOKEN REPLACEMENT):',
      subDivider,
    ];

    if (entities.length === 0) {
      reportLines.push('Tidak ada entitas PHI terdeteksi.');
    } else {
      entities.forEach((ent, idx) => {
        reportLines.push(
          `[${idx + 1}] Kategori: ${ent.category.padEnd(16)} | Token: ${ent.replacement}`,
        );
      });
    }

    reportLines.push('', '2. EKSTRAKSI BIOMARKER LABORATORIUM & KODE LOINC:', subDivider);

    if (labRecords.length === 0) {
      reportLines.push('Tidak ada nilai biomarker laboratorium terdeteksi.');
    } else {
      labRecords.forEach((lab, idx) => {
        reportLines.push(
          `[${idx + 1}] ${lab.testName.toUpperCase()}`,
          `    Nilai: ${lab.value} ${lab.unit} (Flag: ${(lab.flag ?? 'NORMAL').toUpperCase()})`,
          `    Kode LOINC: ${lab.loincCode}`,
          `    Rentang Rujukan: ${lab.referenceRange || 'N/A'}`,
          '',
        );
      });
    }

    reportLines.push(
      '3. RINGKASAN FHIR R4 TRANSACTION BUNDLE:',
      subDivider,
      `Bundle ID: ${assembledBundle?.id || 'N/A'}`,
      `Total Sumber Daya (Entries): ${assembledBundle?.entry?.length || 0}`,
      `Jenis Sumber Daya: Patient (Tokenized), Observation (Labs)`,
      '',
      '4. TEKS KLINIS TER-DEIDENTIFIKASI (REDACTED NARRATIVE):',
      subDivider,
      deidentifiedText || '(Kosong)',
      '',
      divider,
      'Dihasilkan secara lokal oleh internize.ai Engine (tanpa panggilan jaringan saat ekspor)',
      divider,
    );

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_extraction_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowToast?.('Laporan riset terstruktur (.txt) berhasil diunduh', 'success');
  };

  const flagVariant = (flag: string | undefined): 'danger' | 'success' | 'warning' | 'primary' => {
    if (flag === 'high' || flag === 'critical') return 'danger';
    if (flag === 'low') return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* Raw Input */}
      <Card>
        <CardHeader className="py-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <CardTitle>Raw Narrative Input</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadSample}
              className="text-xs text-sky-600 hover:text-sky-700 h-7 px-2"
            >
              Sample EMR
            </Button>
            {rawText && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-rose-600 h-7 px-1.5"
                title="Clear input"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <textarea
            value={rawText}
            onChange={handleTextChange}
            placeholder="Paste raw patient record containing PHI and laboratory data..."
            className="w-full h-24 text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none font-sans leading-relaxed text-slate-800 placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">{rawText.length} characters</span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isProcessing}
              onClick={handleProcessDeid}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>De-identify &amp; Extract</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* HIPAA Compliance & De-identified Preview */}
      {deidentifiedText && hipaaResult && (
        <Card>
          <CardHeader className="py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${hipaaResult.compliant ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <CardTitle>HIPAA Safe Harbor De-identified</CardTitle>
            </div>
            <Badge
              variant={hipaaResult.compliant ? 'success' : 'warning'}
              size="sm"
              className="font-semibold"
            >
              {hipaaResult.compliant ? 'Compliant: YES' : 'Review Required'}
            </Badge>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">
              {deidentifiedText}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Redacted: {entities.length} identifier(s)</span>
              <span
                className={
                  hipaaResult.residualRisk === 'high'
                    ? 'text-rose-600 font-medium'
                    : hipaaResult.residualRisk === 'moderate'
                      ? 'text-amber-600 font-medium'
                      : 'text-emerald-700 font-medium'
                }
              >
                Residual risk: {hipaaResult.residualRisk}
              </span>
            </div>
            {/* Entity category pills */}
            {entities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[...new Set(entities.map((e) => e.category))].map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-100"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LOINC Lab Biomarkers Table */}
      {labRecords.length > 0 && (
        <Card>
          <CardHeader className="py-2.5">
            <div className="flex items-center gap-1.5">
              <TestTube className="w-4 h-4 text-sky-600" />
              <CardTitle>LOINC Lab Biomarkers</CardTitle>
            </div>
            <Badge variant="primary" size="sm">
              {labRecords.length} record{labRecords.length !== 1 ? 's' : ''}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {labRecords.map((lab) => (
                <div
                  key={lab.loincCode}
                  className="p-3 flex items-center justify-between hover:bg-slate-50/50"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800">{lab.testName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">LOINC: {lab.loincCode}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{lab.value}</span>
                      <span className="text-[11px] text-slate-500">{lab.unit}</span>
                      {lab.flag && lab.flag !== 'normal' && (
                        <Badge
                          variant={flagVariant(lab.flag)}
                          size="sm"
                          className="text-[9px] py-0 uppercase"
                        >
                          {lab.flag}
                        </Badge>
                      )}
                      {lab.flag === 'normal' && (
                        <Badge variant="success" size="sm" className="text-[9px] py-0">
                          NORMAL
                        </Badge>
                      )}
                    </div>
                    {lab.referenceRange && (
                      <p className="text-[10px] text-slate-400">Ref: {lab.referenceRange}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Actions */}
      {assembledBundle && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadFhir}
            className="flex-1 gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>Download FHIR (.json)</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownloadTxt}
            className="flex-1 gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Laporan (.txt)</span>
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!deidentifiedText && !isProcessing && (
        <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ArrowRight className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-slate-600">No narrative analyzed yet</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Click &ldquo;Sample EMR&rdquo; above to preview automated Safe Harbor redaction and
            LOINC extraction.
          </p>
        </div>
      )}
    </div>
  );
};
