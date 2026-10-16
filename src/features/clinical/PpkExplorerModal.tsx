import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Search,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PpkInvertedIndex } from '../../services/clinical/knowledge/ppkInvertedIndex';
import type { PapdiDivision, PpkStoredDocument } from '../../services/clinical/knowledge/ppkTypes';

export interface PpkExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuideline?: (doc: PpkStoredDocument) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const DIVISIONS: Array<{ id: 'ALL' | PapdiDivision; label: string }> = [
  { id: 'ALL', label: 'Semua (121)' },
  { id: 'ENDOKRIN', label: 'Endokrin' },
  { id: 'GASTRO', label: 'Gastro' },
  { id: 'GERIATRI', label: 'Geriatri' },
  { id: 'HOM', label: 'HOM' },
  { id: 'IMUN', label: 'Alergi-Imun' },
  { id: 'NEFRO', label: 'Nefro-Hipertensi' },
  { id: 'PARU', label: 'Pulmonologi' },
  { id: 'REMATO', label: 'Reumatologi' },
  { id: 'TROPIK', label: 'Tropik-Infeksi' },
];

export const PpkExplorerModal: React.FC<PpkExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectGuideline,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<'ALL' | PapdiDivision>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<PpkStoredDocument | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdx' | 'ptx' | 'pmx' | 'pex' | 'icu'>('ptx');

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
      limit: 50,
      minScore: 10,
    });

    if (results.length > 0) {
      return results.map((r) => r.doc);
    }

    // Fallback simple substring search across title, icd10 primary, and diagnosis
    const qLower = searchQuery.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(qLower) ||
        (d.icd10?.primary && d.icd10.primary.toLowerCase().includes(qLower)) ||
        d.definisi?.toLowerCase().includes(qLower) ||
        d.kriteriaDiagnosis?.criteriaList?.some((c) => c.toLowerCase().includes(qLower)),
    );
  }, [allDocs, index, searchQuery, selectedDivision]);

  const handleCopySummary = (doc: PpkStoredDocument) => {
    const lines: string[] = [
      `=== RINGKASAN PANDUAN PRAKTIK KLINIS (PPK) SP.PD ===`,
      `Judul: ${doc.title} (${doc.division})`,
      `ICD-10: ${doc.icd10?.primary || '-'} | Tahun: ${doc.editionYear}`,
      '',
      `1. DIAGNOSIS & KRITERIA:`,
      doc.definisi ? `Definisi: ${doc.definisi}` : '',
      ...(doc.kriteriaDiagnosis?.criteriaList?.map((c) => `- ${c}`) || []),
      '',
      `2. PEMERIKSAAN PENUNJANG (Pdx):`,
      ...(doc.pdx?.laboratorium?.map((l) => `- Lab: ${l}`) || []),
      ...(doc.pdx?.radiologi?.map((r) => `- Radiologi: ${r}`) || []),
      '',
      `3. TATALAKSANA & DOSIS (Ptx):`,
      ...(doc.ptx?.medikamentosa?.lini1?.map((t) => `- Lini 1: ${t.drugName} (${t.dose} ${t.route} ${t.frequency})`) || []),
      ...(doc.ptx?.medikamentosa?.lini2?.map((t) => `- Lini 2: ${t.drugName} (${t.dose} ${t.route} ${t.frequency})`) || []),
      ...(doc.ptx?.kontraindikasiDanRedFlags?.map((k) => `! Kontraindikasi: ${k}`) || []),
      '',
      `4. MONITORING & TARGET (Pmx):`,
      ...(doc.pmx?.targetKlinis?.map((m) => `- Target Klinis: ${m}`) || []),
      ...(doc.pmx?.targetLab?.map((m) => `- Target Lab: ${m}`) || []),
      '',
      `5. EDUKASI (Pex):`,
      ...(doc.pex?.konselingPenyakit?.map((e) => `- ${e}`) || []),
      ...(doc.pex?.tandaBahayaEmergency?.map((e) => `! Tanda Bahaya: ${e}`) || []),
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShowToast?.(`Ringkasan PPK "${doc.title}" disalin ke clipboard!`, 'success');
    });
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
      className="max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden"
    >
      {/* Header Modal */}
      <div className="bg-gradient-to-r from-maroon-900 via-maroon-950 to-slate-900 p-3.5 text-white flex items-center justify-between border-b border-gold-600/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-maroon-800 border border-gold-500/50 flex items-center justify-center text-gold-300 shadow-sm shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold tracking-tight text-gold-100">
                PPK Explorer Sp.PD
              </h2>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-300 border border-gold-400/40">
                121 Panduan
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium">
              Basis Pengetahuan Panduan Praktik Klinis 9 Divisi PAPDI
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body Grid */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row bg-slate-50">
        {/* Left Column: Search & Guideline List */}
        <div className="w-full sm:w-64 border-r border-slate-200 flex flex-col bg-white shrink-0 max-h-[38vh] sm:max-h-full">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari penyakit, obat, kriteria..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 bg-slate-50 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Division Filter Badges */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[9.5px]">
              {DIVISIONS.map((div) => (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setSelectedDivision(div.id)}
                  className={`px-2 py-0.5 rounded-full font-semibold shrink-0 transition-colors ${
                    selectedDivision === div.id
                      ? 'bg-maroon-900 text-gold-200 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {div.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Guidelines */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredDocs.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Tidak ada PPK yang cocok dengan kata kunci.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleSelectDoc(doc)}
                    className={`w-full text-left p-2.5 transition-colors flex items-start justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-maroon-50/80 border-l-4 border-maroon-800 text-maroon-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-black uppercase px-1 rounded bg-slate-100 text-slate-600">
                          {doc.division}
                        </span>
                        {doc.icd10?.primary && (
                          <span className="text-[9px] font-mono font-semibold text-slate-500">
                            {doc.icd10.primary}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold leading-snug line-clamp-2">
                        {doc.title}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Guideline Detail Viewer */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-slate-50/70">
          {selectedDoc ? (
            <div className="space-y-3.5 flex-1 flex flex-col">
              {/* Document Header */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="primary" size="sm" className="bg-maroon-900 text-gold-300 font-extrabold text-[9.5px]">
                        {selectedDoc.division}
                      </Badge>
                      <Badge variant="outline" size="sm" className="text-[9.5px]">
                        {selectedDoc.docType === 'CLINICAL_PATHWAY' ? 'Clinical Pathway' : 'PPK'}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-500">
                        ICD-10: {selectedDoc.icd10?.primary || '-'} &bull; Tahun {selectedDoc.editionYear}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {selectedDoc.title}
                    </h3>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopySummary(selectedDoc)}
                    className="shrink-0 h-8 gap-1 text-[11px]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Clipboard className="w-3 h-3" />}
                    <span>{copied ? 'Tersalin' : 'Salin PPK'}</span>
                  </Button>
                </div>

                {selectedDoc.definisi && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-sans">
                    <span className="font-bold text-slate-800">Definisi: </span>
                    {selectedDoc.definisi}
                  </p>
                )}
              </div>

              {/* 4P Sub-tabs */}
              <div className="flex gap-1 border-b border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('ptx')}
                  className={`pb-1.5 px-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'ptx'
                      ? 'border-maroon-800 text-maroon-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Terapi & Dosis (Ptx)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pdx')}
                  className={`pb-1.5 px-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'pdx'
                      ? 'border-maroon-800 text-maroon-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Penunjang (Pdx)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pmx')}
                  className={`pb-1.5 px-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'pmx'
                      ? 'border-maroon-800 text-maroon-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monitoring (Pmx)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pex')}
                  className={`pb-1.5 px-2.5 font-bold transition-all border-b-2 ${
                    activeTab === 'pex'
                      ? 'border-maroon-800 text-maroon-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Edukasi (Pex)
                </button>
                {selectedDoc.kegawatanDanRujukan?.kriteriaIcu && selectedDoc.kegawatanDanRujukan.kriteriaIcu.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('icu')}
                    className={`pb-1.5 px-2.5 font-bold transition-all border-b-2 ${
                      activeTab === 'icu'
                        ? 'border-rose-600 text-rose-700'
                        : 'border-transparent text-rose-500 hover:text-rose-700'
                    }`}
                  >
                    Kriteria ICU
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 flex-1">
                {activeTab === 'ptx' && (
                  <div className="space-y-3 text-xs">
                    {/* Lini 1 */}
                    {selectedDoc.ptx?.medikamentosa?.lini1 && selectedDoc.ptx.medikamentosa.lini1.length > 0 && (
                      <div>
                        <div className="font-bold text-slate-800 text-[11.5px] mb-1.5 flex items-center gap-1.5 text-emerald-800">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Terapi Lini 1 & Rekomendasi Dosis:</span>
                        </div>
                        <ul className="space-y-1.5 pl-1">
                          {selectedDoc.ptx.medikamentosa.lini1.map((item, idx) => (
                            <li key={idx} className="bg-emerald-50/60 border border-emerald-200/80 p-2 rounded-lg">
                              <span className="font-extrabold text-emerald-950">{item.drugName}</span>
                              {item.dose && <span className="text-emerald-800 font-semibold ml-1.5">&bull; {item.dose} {item.route} {item.frequency}</span>}
                              {item.notes && <p className="text-[11px] text-emerald-700 mt-0.5">{item.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lini 2 */}
                    {selectedDoc.ptx?.medikamentosa?.lini2 && selectedDoc.ptx.medikamentosa.lini2.length > 0 && (
                      <div>
                        <div className="font-bold text-slate-800 text-[11.5px] mb-1.5 flex items-center gap-1.5 text-sky-800">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Terapi Lini 2 / Alternatif:</span>
                        </div>
                        <ul className="space-y-1.5 pl-1">
                          {selectedDoc.ptx.medikamentosa.lini2.map((item, idx) => (
                            <li key={idx} className="bg-sky-50/60 border border-sky-200/80 p-2 rounded-lg">
                              <span className="font-extrabold text-sky-950">{item.drugName}</span>
                              {item.dose && <span className="text-sky-800 font-semibold ml-1.5">&bull; {item.dose} {item.route} {item.frequency}</span>}
                              {item.notes && <p className="text-[11px] text-sky-700 mt-0.5">{item.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Kontraindikasi & Red Flags */}
                    {selectedDoc.ptx?.kontraindikasiDanRedFlags && selectedDoc.ptx.kontraindikasiDanRedFlags.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg space-y-1">
                        <div className="font-bold text-rose-900 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Kontraindikasi & Bahaya Obat:</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-rose-800 text-[11px]">
                          {selectedDoc.ptx.kontraindikasiDanRedFlags.map((k, idx) => (
                            <li key={idx}>{k}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pdx' && (
                  <div className="space-y-3 text-xs">
                    {selectedDoc.pdx?.laboratorium && selectedDoc.pdx.laboratorium.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Pemeriksaan Laboratorium:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {selectedDoc.pdx.laboratorium.map((l, idx) => (
                            <li key={idx}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDoc.pdx?.radiologi && selectedDoc.pdx.radiologi.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Radiologi & Imaging:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {selectedDoc.pdx.radiologi.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pmx' && (
                  <div className="space-y-3 text-xs">
                    {selectedDoc.pmx?.targetKlinis && selectedDoc.pmx.targetKlinis.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Target Monitoring Klinis:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {selectedDoc.pmx.targetKlinis.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDoc.pmx?.targetLab && selectedDoc.pmx.targetLab.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Target Evaluasi Laboratorium:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {selectedDoc.pmx.targetLab.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDoc.pmx?.targetLamaRawatHari && (
                      <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-800">
                        <span className="font-bold">Estimasi Lama Rawat Inap (LOS): </span>
                        {selectedDoc.pmx.targetLamaRawatHari} Hari
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pex' && (
                  <div className="space-y-3 text-xs">
                    {selectedDoc.pex?.konselingPenyakit && selectedDoc.pex.konselingPenyakit.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Konseling Penyakit & Pola Hidup:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {selectedDoc.pex.konselingPenyakit.map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDoc.pex?.tandaBahayaEmergency && selectedDoc.pex.tandaBahayaEmergency.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg space-y-1">
                        <span className="font-bold text-amber-900 block">Tanda Bahaya Emergency (Red Flags):</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                          {selectedDoc.pex.tandaBahayaEmergency.map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'icu' && selectedDoc.kegawatanDanRujukan?.kriteriaIcu && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Kriteria Masuk Ruang Rawat Intensif (ICU/HCU):</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-800">
                      {selectedDoc.kegawatanDanRujukan.kriteriaIcu.map((crit: string, idx: number) => (
                        <li key={idx}>{crit}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <Stethoscope className="w-10 h-10 text-slate-300 stroke-1" />
              <p className="text-xs font-medium">Pilih salah satu panduan klinis di sebelah kiri untuk melihat algoritma 4P & dosis.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
