import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  FileCheck,
  HeartPulse,
  Layers,
  Pill,
  Search,
  ShieldAlert,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PpkCitationFormatter } from '../../services/clinical/knowledge/ppkCitationFormatter';
import { PpkInvertedIndex } from '../../services/clinical/knowledge/ppkInvertedIndex';
import type {
  PapdiDivision,
  PpkMatchedGuideline,
  PpkStoredDocument,
} from '../../services/clinical/knowledge/ppkTypes';

export interface PpkExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuideline?: (doc: PpkStoredDocument) => void;
  onApplyToCase?: (doc: PpkStoredDocument, templateText: string) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PAPDI_DIVISIONS: Array<{ id: 'ALL' | PapdiDivision; label: string; count: number }> = [
  { id: 'ALL', label: 'Semua', count: 121 },
  { id: 'ENDOKRIN', label: 'Endokrin-Metabolik', count: 9 },
  { id: 'GASTRO', label: 'Gastroenterohepatologi', count: 15 },
  { id: 'GERIATRI', label: 'Geriatri', count: 20 },
  { id: 'HOM', label: 'Hematologi-Onkologi', count: 30 },
  { id: 'IMUN', label: 'Alergi-Imunologi', count: 1 },
  { id: 'NEFRO', label: 'Ginjal-Hipertensi', count: 6 },
  { id: 'PARU', label: 'Pulmonologi', count: 14 },
  { id: 'REMATO', label: 'Reumatologi', count: 10 },
  { id: 'TROPIK', label: 'Tropik-Infeksi', count: 16 },
];

/**
 * Converts a stored PPK document to a matched guideline structure for citation formatting.
 */
export function storedDocToMatchedGuideline(doc: PpkStoredDocument): PpkMatchedGuideline {
  const index = PpkInvertedIndex.getInstance();
  return {
    documentId: doc.id,
    documentTitle: doc.title,
    division: doc.division,
    docType: doc.docType,
    sourceFile: index.getSourceFileName(doc.id),
    icd10: doc.icd10 || { primary: '-' },
    matchedKeywords: [doc.title],
    matchScore: 100,
    definisi: doc.definisi || '',
    anamnesis: doc.anamnesis || [],
    physicalSigns: doc.pemeriksaanFisik?.physicalSigns || [],
    kriteriaDiagnosis: doc.kriteriaDiagnosis?.criteriaList || [],
    pdx: doc.pdx || { laboratorium: [], radiologi: [], prosedurDiagnostik: [] },
    ptx: {
      nonMedikamentosa: doc.ptx?.nonMedikamentosa || [],
      lini1: doc.ptx?.medikamentosa?.lini1 || [],
      lini2: doc.ptx?.medikamentosa?.lini2 || [],
      titrasiProtocols: doc.ptx?.titrasiProtocols,
      penyesuaianDosis: doc.ptx?.penyesuaianDosis,
      kontraindikasiDanRedFlags: doc.ptx?.kontraindikasiDanRedFlags || [],
    },
    pmx: doc.pmx || { targetKlinis: [], targetLab: [] },
    pex: doc.pex || {
      konselingPenyakit: [],
      kepatuhanObatDanDiet: [],
      tandaBahayaEmergency: [],
    },
    kegawatanDanRujukan: doc.kegawatanDanRujukan,
    scoringSystems: doc.scoringSystems,
    citations: doc.kepustakaan || [],
  };
}

/**
 * Generates canonical PAPDI 2024 citation string for a PPK document.
 */
export function formatPpkCitation(
  doc: PpkStoredDocument,
  section = 'Rekomendasi Terapi & Dosis (Ptx)',
): string {
  const guideline = storedDocToMatchedGuideline(doc);
  return PpkCitationFormatter.getInstance().formatCitation(guideline, section);
}

/**
 * Formats a comprehensive human-readable summary of the PPK document covering all 4P pillars.
 */
export function formatPpkSummary(doc: PpkStoredDocument): string {
  const citation = formatPpkCitation(doc);
  const lines: string[] = [
    '=== RINGKASAN PANDUAN PRAKTIK KLINIS (PPK) SP.PD ===',
    `Judul: ${doc.title} (${doc.division})`,
    `ICD-10: ${doc.icd10?.primary || '-'} | Edisi: ${doc.editionYear}`,
    `Sitasi Resmi: ${citation}`,
    '',
    '1. DEFINISI & KRITERIA DIAGNOSIS:',
    doc.definisi ? `Definisi: ${doc.definisi}` : '',
    ...(doc.kriteriaDiagnosis?.criteriaList?.map((c) => `- ${c}`) || []),
    '',
    '2. PEMERIKSAAN PENUNJANG (Pdx):',
    ...(doc.pdx?.laboratorium?.map((l) => `- Lab: ${l}`) || []),
    ...(doc.pdx?.radiologi?.map((r) => `- Radiologi: ${r}`) || []),
    ...(doc.pdx?.prosedurDiagnostik?.map((p) => `- Prosedur: ${p}`) || []),
    '',
    '3. TATALAKSANA & DOSIS (Ptx):',
    ...(doc.ptx?.nonMedikamentosa?.map((n) => `- Non-Medikamentosa: ${n}`) || []),
    ...(doc.ptx?.medikamentosa?.lini1?.map(
      (t) =>
        `- Lini 1: ${t.drugName} (${t.dose} ${t.route} ${t.frequency}${t.notes ? ` - ${t.notes}` : ''})`,
    ) || []),
    ...(doc.ptx?.medikamentosa?.lini2?.map(
      (t) =>
        `- Lini 2: ${t.drugName} (${t.dose} ${t.route} ${t.frequency}${t.notes ? ` - ${t.notes}` : ''})`,
    ) || []),
    ...(doc.ptx?.kontraindikasiDanRedFlags?.map((k) => `! Kontraindikasi/Red Flag: ${k}`) || []),
    '',
    '4. MONITORING & TARGET (Pmx):',
    ...(doc.pmx?.targetKlinis?.map((m) => `- Target Klinis: ${m}`) || []),
    ...(doc.pmx?.targetLab?.map((m) => `- Target Lab: ${m}`) || []),
    doc.pmx?.targetLamaRawatHari
      ? `- Target Lama Rawat (LOS): ${doc.pmx.targetLamaRawatHari} Hari`
      : '',
    '',
    '5. EDUKASI PASIEN & KELUARGA (Pex):',
    ...(doc.pex?.konselingPenyakit?.map((e) => `- Konseling: ${e}`) || []),
    ...(doc.pex?.kepatuhanObatDanDiet?.map((e) => `- Kepatuhan: ${e}`) || []),
    ...(doc.pex?.tandaBahayaEmergency?.map((e) => `! Tanda Bahaya: ${e}`) || []),
  ];

  if (doc.kegawatanDanRujukan?.kriteriaIcu && doc.kegawatanDanRujukan.kriteriaIcu.length > 0) {
    lines.push('', '6. KRITERIA ICU/HCU:');
    for (const crit of doc.kegawatanDanRujukan.kriteriaIcu) {
      lines.push(`! ${crit}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Formats a clean clinical note template ready to be inserted into a patient case draft.
 */
export function formatPpkCaseTemplate(doc: PpkStoredDocument): string {
  const ptxLini1 =
    doc.ptx?.medikamentosa?.lini1
      ?.map(
        (m) =>
          `• ${m.drugName}: ${m.dose} ${m.route} ${m.frequency}${m.notes ? ` (${m.notes})` : ''}`,
      )
      .join('\n') || '• Terapi suportif & simptomatik per indikasi klinis';

  const pdxLab =
    doc.pdx?.laboratorium?.slice(0, 5).join(', ') || 'Darah lengkap, ureum, kreatinin, elektrolit';
  const pmxKlinis =
    doc.pmx?.targetKlinis?.slice(0, 3).join('; ') ||
    'Monitoring tanda-tanda vital serial per 2-4 jam';

  return `Pasien dengan masalah aktif: ${doc.title} (${doc.division}, ICD-10: ${doc.icd10?.primary || '-'}).

[ANAMNESIS & TEMUAN KLINIS]:
Keluhan dominan sesuai panduan klinis ${doc.title}.
Tanda klinis relevan: ${doc.anamnesis?.slice(0, 2).join('; ') || 'Sesuai konsensus PPK'}.
Pemeriksaan Fisik: ${doc.pemeriksaanFisik?.physicalSigns?.slice(0, 2).join('; ') || 'Dalam batas evaluasi serial'}.

[USULAN PEMERIKSAAN PENUNJANG (Pdx)]:
- Laboratorium: ${pdxLab}
- Radiologi / Penunjang: ${doc.pdx?.radiologi?.slice(0, 2).join(', ') || 'Foto Toraks AP/PA (bila indikasi)'}

[REKOMENDASI TATALAKSANA (Ptx - PPK PAPDI 2024)]:
${ptxLini1}

[TARGET PEMANTAUAN (Pmx)]:
- Klinis: ${pmxKlinis}
- Target Lab: ${doc.pmx?.targetLab?.slice(0, 2).join('; ') || 'Evaluasi elektrolit & fungsi organ serial'}

[EDUKASI PASIEN & KELUARGA (Pex)]:
- ${doc.pex?.konselingPenyakit?.[0] || 'Penjelasan perjalanan penyakit dan rencana tatalaksana'}
- Tanda Bahaya: ${doc.pex?.tandaBahayaEmergency?.[0] || 'Laporkan segera bila timbul sesak napas bertambah, oliguria, atau penurunan kesadaran'}`;
}

export const PpkExplorerModal: React.FC<PpkExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectGuideline,
  onApplyToCase,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<'ALL' | PapdiDivision>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<PpkStoredDocument | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ptx' | 'pdx' | 'pmx' | 'pex' | 'icu' | 'citasi'>(
    'ptx',
  );

  const index = useMemo(() => PpkInvertedIndex.getInstance(), []);
  const allDocs = useMemo(() => index.getAllDocuments(), [index]);

  const filteredDocs = useMemo(() => {
    let docs = allDocs;

    if (selectedDivision !== 'ALL') {
      docs = docs.filter((d) => d.division === selectedDivision);
    }

    if (!searchQuery.trim()) {
      return docs;
    }

    // Use inverted index search
    const results = index.search(searchQuery.trim(), {
      division: selectedDivision === 'ALL' ? undefined : selectedDivision,
      limit: 100,
      minScore: 10,
    });

    if (results.length > 0) {
      return results.map((r) => r.doc);
    }

    // Fallback simple substring search across title, icd10 primary, definition, criteria
    const qLower = searchQuery.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(qLower) ||
        d.icd10?.primary?.toLowerCase().includes(qLower) ||
        d.definisi?.toLowerCase().includes(qLower) ||
        d.kriteriaDiagnosis?.criteriaList?.some((c) => c.toLowerCase().includes(qLower)),
    );
  }, [allDocs, index, searchQuery, selectedDivision]);

  // Set default selected document on opening
  useMemo(() => {
    if (!selectedDoc && filteredDocs.length > 0) {
      setSelectedDoc(filteredDocs[0]);
    }
  }, [filteredDocs, selectedDoc]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
      onShowToast?.(`${label} berhasil disalin ke clipboard!`, 'success');
    });
  };

  const handleApplyToCase = (doc: PpkStoredDocument) => {
    const template = formatPpkCaseTemplate(doc);
    if (onApplyToCase) {
      onApplyToCase(doc, template);
    } else if (onSelectGuideline) {
      onSelectGuideline(doc);
    }
    onClose();
  };

  const handleSelectDoc = (doc: PpkStoredDocument) => {
    setSelectedDoc(doc);
    onSelectGuideline?.(doc);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="w-[96vw] max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border-maroon-800/40"
    >
      {/* ── Modal Header ── */}
      <div className="bg-gradient-to-r from-maroon-950 via-maroon-900 to-slate-950 p-3.5 text-white flex items-center justify-between border-b border-gold-600/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-maroon-800/90 border border-gold-500/60 flex items-center justify-center text-gold-300 shadow-md shrink-0">
            <BookOpen className="w-5 h-5 text-gold-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-gold-100">
                PPK Explorer Sp.PD (121 Panduan)
              </h2>
              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-400/40">
                PAPDI 2024
              </span>
              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                100% On-Device
              </span>
            </div>
            <p className="text-[10.5px] text-slate-300 font-medium">
              Cari cepat kriteria diagnosis, algoritma 4P (Pdx, Ptx, Pmx, Pex), kriteria ICU &amp;
              sitasi resmi
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Tutup (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Main Layout: Sidebar & Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row bg-slate-100/70">
        {/* Left Column: Search & Guideline List */}
        <div className="w-full sm:w-80 border-r border-slate-200 flex flex-col bg-white shrink-0 max-h-[35vh] sm:max-h-full">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-200/80 space-y-2 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari penyakit, obat, ICD-10 (KAD, STEMI, E11)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 bg-white placeholder:text-slate-400 font-sans shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Division Filter Badges */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[9.5px]">
              {PAPDI_DIVISIONS.map((div) => {
                const isSelected = selectedDivision === div.id;
                return (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => setSelectedDivision(div.id)}
                    className={`px-2 py-0.5 rounded-full font-bold shrink-0 transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-maroon-900 text-gold-200 shadow-2xs border border-maroon-700'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    <span>{div.label}</span>
                    <span
                      className={`text-[8.5px] px-1 rounded-full ${
                        isSelected ? 'bg-gold-500/30 text-gold-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {div.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
              <span>
                Menampilkan: <strong>{filteredDocs.length}</strong> panduan
              </span>
              {selectedDivision !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedDivision('ALL')}
                  className="text-maroon-700 font-bold hover:underline"
                >
                  Reset filter
                </button>
              )}
            </div>
          </div>

          {/* List of Guidelines */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredDocs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs space-y-1">
                <Search className="w-6 h-6 mx-auto text-slate-300 stroke-1" />
                <p className="font-semibold text-slate-600">Tidak ada PPK yang cocok</p>
                <p className="text-[11px]">
                  Coba kata kunci lain atau pilih &quot;Semua&quot; divisi.
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleSelectDoc(doc)}
                    className={`w-full text-left p-2.5 transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-maroon-50/90 border-l-4 border-maroon-900 text-maroon-950 font-bold shadow-2xs'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                          {doc.division}
                        </span>
                        {doc.icd10?.primary && (
                          <span className="text-[9px] font-mono font-semibold text-slate-500">
                            {doc.icd10.primary}
                          </span>
                        )}
                        {doc.docType === 'CLINICAL_PATHWAY' && (
                          <span className="text-[8px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                            CPW
                          </span>
                        )}
                        {doc.docType === 'CHEMO_PROTOCOL' && (
                          <span className="text-[8px] font-bold px-1 rounded bg-purple-100 text-purple-800">
                            KEMO
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold leading-snug line-clamp-2">{doc.title}</p>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 mt-1 ${isSelected ? 'text-maroon-800' : 'text-slate-300'}`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Guideline Detail Viewer */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-slate-50">
          {selectedDoc ? (
            <div className="space-y-3.5 flex-1 flex flex-col">
              {/* Document Banner */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="primary"
                        size="sm"
                        className="bg-maroon-900 text-gold-300 font-extrabold text-[9.5px]"
                      >
                        {selectedDoc.division}
                      </Badge>
                      <Badge variant="outline" size="sm" className="text-[9.5px]">
                        {selectedDoc.docType === 'CLINICAL_PATHWAY'
                          ? 'Clinical Pathway'
                          : selectedDoc.docType === 'CHEMO_PROTOCOL'
                            ? 'Protokol Kemoterapi'
                            : 'Panduan Praktik Klinis'}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-500">
                        ICD-10: <strong>{selectedDoc.icd10?.primary || '-'}</strong> &bull; Edisi
                        PAPDI {selectedDoc.editionYear}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {selectedDoc.title}
                    </h3>
                  </div>

                  {/* Actions Header Toolbar */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(formatPpkSummary(selectedDoc), 'Ringkasan PPK')}
                      className="h-7 px-2 text-[11px] gap-1 border-slate-300"
                      title="Salin ringkasan lengkap 4P ke clipboard"
                    >
                      {copiedKey === 'Ringkasan PPK' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Clipboard className="w-3 h-3 text-slate-600" />
                      )}
                      <span>{copiedKey === 'Ringkasan PPK' ? 'Tersalin' : 'Salin 4P'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopy(formatPpkCitation(selectedDoc), 'Sitasi PAPDI 2024')
                      }
                      className="h-7 px-2 text-[11px] gap-1 border-gold-500/50 text-maroon-950 bg-gold-50 hover:bg-gold-100"
                      title="Salin sitasi resmi berstandar PAPDI 2024"
                    >
                      {copiedKey === 'Sitasi PAPDI 2024' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-maroon-800" />
                      )}
                      <span>{copiedKey === 'Sitasi PAPDI 2024' ? 'Tersalin' : 'Salin Sitasi'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplyToCase(selectedDoc)}
                      className="h-7 px-2.5 text-[11px] gap-1 bg-maroon-900 hover:bg-maroon-950 text-gold-200 font-bold border border-gold-500/50 shadow-xs"
                      title="Terapkan panduan ini sebagai template catatan kasus aktif"
                    >
                      <Zap className="w-3 h-3 text-gold-400" />
                      <span>Terapkan ke Kasus</span>
                    </Button>
                  </div>
                </div>

                {/* Definisi */}
                {selectedDoc.definisi && (
                  <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed font-sans">
                    <span className="font-bold text-slate-900">Definisi Klinis: </span>
                    {selectedDoc.definisi}
                  </div>
                )}

                {/* Kriteria Diagnosis / Anamnesis Ringkas */}
                {selectedDoc.kriteriaDiagnosis?.criteriaList &&
                  selectedDoc.kriteriaDiagnosis.criteriaList.length > 0 && (
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-slate-800 text-[11px]">
                        Kriteria Diagnosis{' '}
                        {selectedDoc.kriteriaDiagnosis.systemName
                          ? `(${selectedDoc.kriteriaDiagnosis.systemName})`
                          : ''}
                        :
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-700 text-[11.5px]">
                        {selectedDoc.kriteriaDiagnosis.criteriaList.slice(0, 4).map((crit, idx) => (
                          <li key={`crit-${idx}-${crit.slice(0, 10)}`}>{crit}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* 4P Tabs Navigation */}
              <div className="flex gap-1 border-b border-slate-200 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('ptx')}
                  className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'ptx'
                      ? 'border-maroon-900 text-maroon-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Terapi &amp; Dosis (Ptx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pdx')}
                  className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'pdx'
                      ? 'border-maroon-900 text-maroon-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Penunjang (Pdx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pmx')}
                  className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'pmx'
                      ? 'border-maroon-900 text-maroon-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>Monitoring (Pmx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pex')}
                  className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'pex'
                      ? 'border-maroon-900 text-maroon-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Edukasi (Pex)</span>
                </button>
                {selectedDoc.kegawatanDanRujukan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('icu')}
                    className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'icu'
                        ? 'border-rose-600 text-rose-700'
                        : 'border-transparent text-rose-500 hover:text-rose-700'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Kegawatan &amp; ICU</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('citasi')}
                  className={`pb-1.5 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'citasi'
                      ? 'border-gold-600 text-maroon-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Sitasi &amp; Pustaka</span>
                </button>
              </div>

              {/* Tab Contents Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 flex-1">
                {/* ── PTX: TERAPI & DOSIS ── */}
                {activeTab === 'ptx' && (
                  <div className="space-y-3.5 text-xs">
                    {/* Non-medikamentosa */}
                    {selectedDoc.ptx?.nonMedikamentosa &&
                      selectedDoc.ptx.nonMedikamentosa.length > 0 && (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1">
                            Terapi Non-Medikamentosa &amp; Nutrisi:
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                            {selectedDoc.ptx.nonMedikamentosa.map((n, idx) => (
                              <li key={`nonmed-${idx}-${n.slice(0, 10)}`}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Lini 1 */}
                    {selectedDoc.ptx?.medikamentosa?.lini1 &&
                      selectedDoc.ptx.medikamentosa.lini1.length > 0 && (
                        <div>
                          <div className="font-bold text-[11.5px] mb-1.5 flex items-center justify-between text-emerald-900">
                            <span className="flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Terapi Lini 1 &amp; Rekomendasi Dosis Resmi:</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              {selectedDoc.ptx.medikamentosa.lini1.length} Rejimen
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {selectedDoc.ptx.medikamentosa.lini1.map((item, idx) => (
                              <div
                                key={`lini1-${item.drugName}-${idx}`}
                                className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-lg space-y-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-950 text-xs">
                                    {item.drugName}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                                    {item.route} &bull; {item.frequency}
                                  </span>
                                </div>
                                <p className="text-[11.5px] text-emerald-900 font-medium">
                                  Dosis: <strong>{item.dose}</strong>{' '}
                                  {item.duration ? `(${item.duration})` : ''}
                                </p>
                                {item.notes && (
                                  <p className="text-[10.5px] text-emerald-700 italic pt-0.5">
                                    Catatan: {item.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Lini 2 */}
                    {selectedDoc.ptx?.medikamentosa?.lini2 &&
                      selectedDoc.ptx.medikamentosa.lini2.length > 0 && (
                        <div>
                          <div className="font-bold text-[11.5px] mb-1.5 flex items-center gap-1.5 text-sky-900">
                            <Activity className="w-3.5 h-3.5 text-sky-700" />
                            <span>Terapi Lini 2 / Alternatif / Eskalasi:</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {selectedDoc.ptx.medikamentosa.lini2.map((item, idx) => (
                              <div
                                key={`lini2-${item.drugName}-${idx}`}
                                className="bg-sky-50/70 border border-sky-200 p-2.5 rounded-lg space-y-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sky-950 text-xs">
                                    {item.drugName}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded">
                                    {item.route} &bull; {item.frequency}
                                  </span>
                                </div>
                                <p className="text-[11.5px] text-sky-900 font-medium">
                                  Dosis: <strong>{item.dose}</strong>{' '}
                                  {item.duration ? `(${item.duration})` : ''}
                                </p>
                                {item.notes && (
                                  <p className="text-[10.5px] text-sky-700 italic pt-0.5">
                                    Catatan: {item.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Protokol Titrasi (Syringe Pump) */}
                    {selectedDoc.ptx?.titrasiProtocols &&
                      selectedDoc.ptx.titrasiProtocols.length > 0 && (
                        <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-lg space-y-2">
                          <span className="font-bold text-indigo-950 block text-[11.5px]">
                            Protokol Titrasi Kontinu (Syringe Pump):
                          </span>
                          {selectedDoc.ptx.titrasiProtocols.map((tp, idx) => (
                            <div
                              key={`tp-${tp.protocolName}-${idx}`}
                              className="space-y-1 text-[11px] text-indigo-900"
                            >
                              <p className="font-semibold">
                                {tp.protocolName} (Starting Rate: {tp.startingRate})
                              </p>
                              <p className="text-[10.5px] text-indigo-700">
                                Target Endpoint: {tp.targetEndpoint}
                              </p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                {tp.steps.map((st, sIdx) => (
                                  <li key={`step-${sIdx}-${st.condition.slice(0, 10)}`}>
                                    {st.condition} &rarr; <strong>{st.rateAdjustment}</strong>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Penyesuaian Dosis Organ */}
                    {selectedDoc.ptx?.penyesuaianDosis &&
                      selectedDoc.ptx.penyesuaianDosis.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg space-y-2">
                          <span className="font-bold text-amber-950 block text-[11.5px]">
                            Penyesuaian Dosis Organ (Renal / Hepatoseluler / Geriatri):
                          </span>
                          <div className="space-y-1 text-[11px] text-amber-900">
                            {selectedDoc.ptx.penyesuaianDosis.map((adj, idx) => (
                              <div
                                key={`adj-${adj.drugName}-${adj.organ}-${idx}`}
                                className="border-b border-amber-200/60 pb-1"
                              >
                                <strong>{adj.drugName}</strong> ({adj.organ.toUpperCase()} -{' '}
                                {adj.threshold}):{' '}
                                <span className="font-semibold text-rose-800">{adj.action}</span>{' '}
                                &bull; {adj.recommendation}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Kontraindikasi & Red Flags */}
                    {selectedDoc.ptx?.kontraindikasiDanRedFlags &&
                      selectedDoc.ptx.kontraindikasiDanRedFlags.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg space-y-1">
                          <div className="font-bold text-rose-950 text-[11.5px] flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Kontraindikasi Mutlak &amp; Peringatan Bahaya (Red Flags):</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5 text-rose-900 text-[11px]">
                            {selectedDoc.ptx.kontraindikasiDanRedFlags.map((k, idx) => (
                              <li key={`contra-${idx}-${k.slice(0, 10)}`}>{k}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* ── PDX: PEMERIKSAAN PENUNJANG ── */}
                {activeTab === 'pdx' && (
                  <div className="space-y-3.5 text-xs">
                    {selectedDoc.pdx?.laboratorium && selectedDoc.pdx.laboratorium.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                          Pemeriksaan Laboratorium &amp; Serial Markers:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {selectedDoc.pdx.laboratorium.map((l, idx) => (
                            <li key={`lab-${idx}-${l.slice(0, 10)}`}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedDoc.pdx?.radiologi && selectedDoc.pdx.radiologi.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                          Pemeriksaan Radiologi &amp; Pencitraan:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {selectedDoc.pdx.radiologi.map((r, idx) => (
                            <li key={`rad-${idx}-${r.slice(0, 10)}`}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedDoc.pdx?.prosedurDiagnostik &&
                      selectedDoc.pdx.prosedurDiagnostik.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                            Prosedur Diagnostik Khusus (Invasif / Non-Invasif):
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-slate-700">
                            {selectedDoc.pdx.prosedurDiagnostik.map((p, idx) => (
                              <li key={`proc-${idx}-${p.slice(0, 10)}`}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* ── PMX: MONITORING & TARGET ── */}
                {activeTab === 'pmx' && (
                  <div className="space-y-3.5 text-xs">
                    {selectedDoc.pmx?.targetKlinis && selectedDoc.pmx.targetKlinis.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                          Target Pemantauan Klinis &amp; Hemodinamik:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {selectedDoc.pmx.targetKlinis.map((m, idx) => (
                            <li key={`pmx-klinis-${idx}-${m.slice(0, 10)}`}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedDoc.pmx?.targetLab && selectedDoc.pmx.targetLab.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                          Target Evaluasi Laboratorium Serial:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {selectedDoc.pmx.targetLab.map((m, idx) => (
                            <li key={`pmx-lab-${idx}-${m.slice(0, 10)}`}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedDoc.pmx?.targetLamaRawatHari && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between">
                        <span className="font-bold">Estimasi Lama Rawat Inap (Target LOS):</span>
                        <span className="font-extrabold text-sm text-maroon-900">
                          {selectedDoc.pmx.targetLamaRawatHari} Hari
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── PEX: EDUKASI PASIEN ── */}
                {activeTab === 'pex' && (
                  <div className="space-y-3.5 text-xs">
                    {selectedDoc.pex?.konselingPenyakit &&
                      selectedDoc.pex.konselingPenyakit.length > 0 && (
                        <div>
                          <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                            Konseling Penyakit, Faktor Risiko &amp; Rencana Tatalaksana:
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-slate-700">
                            {selectedDoc.pex.konselingPenyakit.map((e, idx) => (
                              <li key={`pex-konseling-${idx}-${e.slice(0, 10)}`}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedDoc.pex?.kepatuhanObatDanDiet &&
                      selectedDoc.pex.kepatuhanObatDanDiet.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                            Kepatuhan Minum Obat &amp; Modifikasi Pola Hidup / Diet:
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-slate-700">
                            {selectedDoc.pex.kepatuhanObatDanDiet.map((e, idx) => (
                              <li key={`pex-patuh-${idx}-${e.slice(0, 10)}`}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedDoc.pex?.tandaBahayaEmergency &&
                      selectedDoc.pex.tandaBahayaEmergency.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-1">
                          <span className="font-bold text-amber-950 block text-[11.5px]">
                            Tanda Bahaya Emergency (Segera kembali ke IGD):
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-amber-900 text-[11px]">
                            {selectedDoc.pex.tandaBahayaEmergency.map((e, idx) => (
                              <li key={`pex-bahaya-${idx}-${e.slice(0, 10)}`}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* ── KEGAWATAN & ICU / RUJUKAN ── */}
                {activeTab === 'icu' && selectedDoc.kegawatanDanRujukan && (
                  <div className="space-y-3.5 text-xs">
                    {selectedDoc.kegawatanDanRujukan.kriteriaIcu &&
                      selectedDoc.kegawatanDanRujukan.kriteriaIcu.length > 0 && (
                        <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 text-rose-950 font-bold text-[11.5px]">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            <span>Kriteria Masuk Ruang Rawat Intensif (ICU/HCU):</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-rose-900 text-[11.5px]">
                            {selectedDoc.kegawatanDanRujukan.kriteriaIcu.map((crit, idx) => (
                              <li key={`icu-${idx}-${crit.slice(0, 10)}`}>{crit}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedDoc.kegawatanDanRujukan.kriteriaRujukan &&
                      selectedDoc.kegawatanDanRujukan.kriteriaRujukan.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 text-amber-950 font-bold text-[11.5px]">
                            <ExternalLink className="w-4 h-4 text-amber-600" />
                            <span>Kriteria Rujukan Faskes Tingkat Lanjut:</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-amber-900 text-[11.5px]">
                            {selectedDoc.kegawatanDanRujukan.kriteriaRujukan.map((crit, idx) => (
                              <li key={`rujuk-${idx}-${crit.slice(0, 10)}`}>{crit}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedDoc.kegawatanDanRujukan.kriteriaPulang &&
                      selectedDoc.kegawatanDanRujukan.kriteriaPulang.length > 0 && (
                        <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-[11.5px]">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Kriteria Pemulangan Pasien (Discharge Criteria):</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-emerald-900 text-[11.5px]">
                            {selectedDoc.kegawatanDanRujukan.kriteriaPulang.map((crit, idx) => (
                              <li key={`pulang-${idx}-${crit.slice(0, 10)}`}>{crit}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* ── SITASI & KEPUSTAKAAN ── */}
                {activeTab === 'citasi' && (
                  <div className="space-y-3.5 text-xs">
                    {/* Canonical PAPDI 2024 Citation Box */}
                    <div className="bg-gradient-to-r from-gold-50 via-white to-maroon-50 p-3 rounded-lg border border-gold-300 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-maroon-950 text-[11.5px] flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-gold-600" />
                          <span>Sitasi Kanonikal Resmi PAPDI 2024:</span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopy(formatPpkCitation(selectedDoc), 'Sitasi PAPDI 2024')
                          }
                          className="h-6 px-2 text-[10px]"
                        >
                          Salin
                        </Button>
                      </div>
                      <div className="p-2 bg-white rounded border border-gold-200 font-mono text-[11px] text-slate-800 select-text">
                        {formatPpkCitation(selectedDoc)}
                      </div>
                    </div>

                    {/* Source File & Evidence Level */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-700 block">Berkas Sumber:</span>
                        <span className="font-mono text-slate-800 break-all">
                          {index.getSourceFileName(selectedDoc.id)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-700 block">Tingkat Evidens:</span>
                        <span className="text-slate-800">
                          {selectedDoc.tingkatEvidens || 'Level I-A (Konsensus Nasional PAPDI)'}
                        </span>
                      </div>
                    </div>

                    {/* Daftar Pustaka */}
                    {selectedDoc.kepustakaan && selectedDoc.kepustakaan.length > 0 && (
                      <div className="pt-2">
                        <span className="font-bold text-slate-900 block mb-1.5 text-[11.5px]">
                          Daftar Pustaka Konsensus Terkait:
                        </span>
                        <ul className="list-decimal pl-4 space-y-1 text-slate-600 text-[10.5px]">
                          {selectedDoc.kepustakaan.map((pustaka, idx) => (
                            <li
                              key={`pustaka-${idx}-${pustaka.slice(0, 15)}`}
                              className="leading-relaxed"
                            >
                              {pustaka}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <Stethoscope className="w-12 h-12 text-slate-300 stroke-1" />
              <p className="text-xs font-semibold text-slate-600">
                Pilih salah satu panduan klinis di kolom sebelah kiri
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Lihat rekomendasi terapi lini 1 &amp; 2, titrasi syringe pump, penyesuaian dosis
                organ, dan kriteria ICU instan.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PpkExplorerModal;
