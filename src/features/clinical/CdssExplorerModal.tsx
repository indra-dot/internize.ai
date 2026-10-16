/**
 * internize.ai — CDSS Explorer Modal
 * Searchable Clinical Decision Support System Hub integrating all 8 suites
 * from drguswib CDSS (ADJUSTR.IO, Calc-Med, adjustrFluid, adjustrEMD, adjustr-GEH, AdjustrHOM, RheumaTools, Preop).
 * 100% on-device, zero-egress, responsive with mobile auto-focus.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Calculator,
  ShieldAlert,
  ChevronLeft,
  Copy,
  PlusCircle,
  X,
  Check,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  CdssSuiteId,
  CdssCalculatorMeta,
  GuardrailAlert,
} from '../../services/clinical/cdss/types';
import { ALL_CDSS_CALCULATORS, CDSS_SUITES } from '../../services/clinical/cdss/cdssRegistry';
import { calculateRenalDosing, ANTIMICROBIAL_DATABASE } from '../../services/clinical/cdss/adjustrIoEngine';
import {
  calculateVasoactiveSyringePump,
  analyzeAbg,
  calculateHyponatremiaAdrogue,
  calculatePotassiumManagement,
} from '../../services/clinical/cdss/calcMedFluidEngine';
import { calculateBwps } from '../../services/clinical/cdss/adjustrEmdEngine';
import { calculateGbs, calculateCtp } from '../../services/clinical/cdss/adjustrGehEngine';
import { calculatePlasmic } from '../../services/clinical/cdss/adjustrHomEngine';
import { calculateDas28Crp } from '../../services/clinical/cdss/rheumaToolsEngine';
import { PatientContextSnapshot } from '../../services/clinical/cdss/contextRouter';

export interface CdssExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicalText?: string;
  patientContext?: PatientContextSnapshot;
  onInsertToDraft?: (text: string) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const CdssExplorerModal: React.FC<CdssExplorerModalProps> = ({
  isOpen,
  onClose,
  clinicalText: _clinicalText,
  patientContext,
  onInsertToDraft,
  onShowToast,
}) => {
  const [selectedSuite, setSelectedSuite] = useState<'ALL' | CdssSuiteId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states for active calculations
  const [patientWeight, setPatientWeight] = useState<number>(patientContext?.weightKg ?? 60);
  const [patientAge, setPatientAge] = useState<number>(patientContext?.age ?? 55);
  const [patientGender, setPatientGender] = useState<'male' | 'female'>(patientContext?.gender ?? 'male');
  const [serumCr, setSerumCr] = useState<number>(patientContext?.labs?.creatinine ?? 1.2);

  // ABG inputs
  const [abgPh, setAbgPh] = useState<number>(patientContext?.labs?.ph ?? 7.35);
  const [abgPco2, setAbgPco2] = useState<number>(patientContext?.labs?.pco2 ?? 40);
  const [abgHco3, setAbgHco3] = useState<number>(patientContext?.labs?.hco3 ?? 24);

  // Filtered calculators list
  const filteredCalculators = useMemo(() => {
    let list = ALL_CDSS_CALCULATORS;
    if (selectedSuite !== 'ALL') {
      list = list.filter((c: CdssCalculatorMeta) => c.suite === selectedSuite);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c: CdssCalculatorMeta) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.keywords.some((k: string) => k.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedSuite, searchQuery]);

  const activeCalculatorMeta = useMemo(() => {
    return ALL_CDSS_CALCULATORS.find((c: CdssCalculatorMeta) => c.id === selectedCalcId) || null;
  }, [selectedCalcId]);

  // Live calculation results & CPPT generation
  const calculationOutput = useMemo(() => {
    if (!selectedCalcId) return null;

    try {
      if (selectedCalcId.startsWith('adjustr-io-') || selectedCalcId === 'calvert-carboplatin' || selectedCalcId === 'mascc-risk') {
        const drugKey = selectedCalcId.replace('adjustr-io-', '');
        if (ANTIMICROBIAL_DATABASE[drugKey]) {
          return calculateRenalDosing(drugKey, {
            age: patientAge,
            weightKg: patientWeight,
            heightCm: 165,
            serumCreatinine: serumCr,
            gender: patientGender,
          });
        }
      }

      if (selectedCalcId === 'calc-abg') {
        return analyzeAbg({
          ph: abgPh,
          pco2: abgPco2,
          hco3: abgHco3,
          na: patientContext?.labs?.sodium ?? 140,
          cl: 105,
          albumin: patientContext?.labs?.albumin ?? 4.0,
          patientWeightKg: patientWeight,
        });
      }

      if (selectedCalcId === 'calc-ne' || selectedCalcId === 'calc-dobu' || selectedCalcId === 'calc-nicardipine') {
        return calculateVasoactiveSyringePump({
          drugType: 'norepinephrine',
          patientWeightKg: patientWeight,
          drugMg: 4,
          diluentVolumeMl: 50,
        });
      }

      if (selectedCalcId === 'fluid-potassium') {
        return calculatePotassiumManagement(patientContext?.labs?.potassium ?? 3.0, patientWeight);
      }

      if (selectedCalcId === 'fluid-hyponatremia') {
        return calculateHyponatremiaAdrogue({
          weightKg: patientWeight,
          gender: patientGender,
          isElderly: patientAge >= 65,
          serumNa: patientContext?.labs?.sodium ?? 122,
          targetRise24h: 8,
          infusateType: 'nacl_3_percent',
        });
      }

      if (selectedCalcId === 'emd-bwps') {
        return calculateBwps({
          tempCelsius: patientContext?.vitals?.temp ?? 38.8,
          cnsDysfunction: 'delirium_psychosis',
          giDysfunction: 'diarrhea_nausea_vomiting',
          heartRate: patientContext?.vitals?.hr ?? 135,
          congestiveHeartFailure: 'mild_pedal_edema',
          atrialFibrillation: true,
          precipitatingEventHistory: true,
        });
      }

      if (selectedCalcId === 'geh-gbs') {
        return calculateGbs({
          bunValue: patientContext?.labs?.ureum ?? 35,
          bunUnit: 'ureum_rs',
          hemoglobin: patientContext?.labs?.hemoglobin ?? 9.2,
          gender: patientGender,
          systolicBp: patientContext?.vitals?.sbp ?? 95,
          heartRate: patientContext?.vitals?.hr ?? 105,
          hasMelena: true,
          hasSyncope: false,
          hasHepaticDisease: false,
          hasHeartFailure: false,
        });
      }

      if (selectedCalcId === 'geh-ctp') {
        return calculateCtp({
          hepaticEncephalopathyGrade: 1,
          ascitesGrade: 2,
          totalBilirubin: patientContext?.labs?.bilirubin ?? 2.8,
          serumAlbumin: patientContext?.labs?.albumin ?? 2.6,
          inr: patientContext?.labs?.inr ?? 1.9,
        });
      }

      if (selectedCalcId === 'hom-plasmic') {
        return calculatePlasmic({
          plateletsBelow30k: true,
          hemolysisPresent: true,
          noActiveCancerInPastYear: true,
          noSolidOrganOrStemCellTransplant: true,
          mcvBelow90: true,
          inrBelow15: true,
          creatinineBelow20: true,
        });
      }

      if (selectedCalcId === 'rheuma-das28') {
        return calculateDas28Crp({
          tenderJointCount28: 8,
          swollenJointCount28: 4,
          crpMgL: patientContext?.labs?.crp ?? 18,
          patientGlobalAssessment0To100: 50,
        });
      }

      return null;
    } catch {
      return null;
    }
  }, [
    selectedCalcId,
    patientAge,
    patientWeight,
    patientGender,
    serumCr,
    abgPh,
    abgPco2,
    abgHco3,
    patientContext,
  ]);

  const handleCopyCppt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('Resume CPPT berhasil disalin ke clipboard!', 'success');
  };

  const handleInsertDraft = (text: string) => {
    onInsertToDraft?.(text);
    onShowToast?.('Hasil kalkulasi CDSS berhasil disisipkan ke draf klinis!', 'success');
    onClose();
  };

  const alerts: GuardrailAlert[] = (calculationOutput && typeof calculationOutput === 'object' && 'alerts' in calculationOutput && Array.isArray((calculationOutput as any).alerts))
    ? ((calculationOutput as any).alerts as GuardrailAlert[])
    : [];

  const cpptText: string = (calculationOutput && typeof calculationOutput === 'object' && 'cpptFormat' in calculationOutput && typeof (calculationOutput as any).cpptFormat === 'string')
    ? (calculationOutput as any).cpptFormat
    : '';

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      hideCloseButton={true}
      className="w-[96vw] max-w-5xl h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-amber-500/30 bg-slate-900"
      bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden p-0"
    >
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#4A151B] border-b border-amber-500/20 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-amber-200">Kalkulator Klinis CDSS</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                drguswib Suite
              </Badge>
            </div>
            <p className="text-[11px] text-amber-200/70">
              ADJUSTR.IO, Calc-Med, adjustrFluid, EMD, GEH, HOM, RheumaTools (Zero Egress)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Tutup (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* MODAL BODY */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* SIDEBAR: SEARCH & SELECTOR */}
        <div
          className={`w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950 shrink-0 ${
            selectedCalcId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* SEARCH & SUITE PILLS */}
          <div className="p-3 border-b border-slate-800 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kalkulator klinis..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto mt-2 pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedSuite('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                  selectedSuite === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({ALL_CDSS_CALCULATORS.length})
              </button>
              {Object.values(CDSS_SUITES).map((suite) => (
                <button
                  key={suite.id}
                  onClick={() => setSelectedSuite(suite.id)}
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                    selectedSuite === suite.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {suite.badge}
                </button>
              ))}
            </div>
          </div>

          {/* CALCULATORS LIST */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredCalculators.map((calc: CdssCalculatorMeta) => {
              const isSelected = calc.id === selectedCalcId;
              return (
                <div
                  key={calc.id}
                  onClick={() => setSelectedCalcId(calc.id)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500/50 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{calc.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-slate-800 text-amber-300 border-slate-700">
                      {calc.suite}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{calc.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN WORKSPACE: CALCULATOR DETAIL & RUNNER */}
        <div
          className={`flex-1 flex flex-col min-h-0 bg-slate-900 overflow-y-auto p-4 md:p-6 ${
            !selectedCalcId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedCalcId && activeCalculatorMeta ? (
            <div className="space-y-6 max-w-3xl">
              {/* BACK BUTTON (MOBILE) & TITLE */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCalcId(null)}
                    className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-amber-100">{activeCalculatorMeta.name}</h3>
                      <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">
                        {activeCalculatorMeta.suite}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{activeCalculatorMeta.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (cpptText) {
                        handleCopyCppt(cpptText);
                      }
                    }}
                    className="border-slate-700 text-slate-300 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline ml-1">Salin CPPT</span>
                  </Button>

                  {onInsertToDraft && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (cpptText) {
                          handleInsertDraft(cpptText);
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Sisipkan ke Draf</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* INPUT FIELDS CARD */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  Parameter Klinis & Biometrik
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Usia (th)</label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Jenis Kelamin</label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value as 'male' | 'female')}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      <option value="male">Laki-laki</option>
                      <option value="female">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Berat Badan (kg)</label>
                    <input
                      type="number"
                      value={patientWeight}
                      onChange={(e) => setPatientWeight(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Serum Kreatinin (mg/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serumCr}
                      onChange={(e) => setSerumCr(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                {/* Specific ABG inputs */}
                {selectedCalcId === 'calc-abg' && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">pH Darah</label>
                      <input
                        type="number"
                        step="0.01"
                        value={abgPh}
                        onChange={(e) => setAbgPh(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">pCO2 (mmHg)</label>
                      <input
                        type="number"
                        value={abgPco2}
                        onChange={(e) => setAbgPco2(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">HCO3 (mEq/L)</label>
                      <input
                        type="number"
                        value={abgHco3}
                        onChange={(e) => setAbgHco3(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE RESULTS & GUARDRAIL ALERTS */}
              {calculationOutput && (
                <div className="space-y-4">
                  {/* ALERTS */}
                  {alerts.length > 0 && (
                    <div className="space-y-2">
                      {alerts.map((alert: GuardrailAlert, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            alert.severity === 'danger'
                              ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold">{alert.title}</span>
                            <p className="mt-0.5 opacity-90">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PREVIEW CPPT FORMAT */}
                  {cpptText && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Format Draf Rekam Medis (CPPT)</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCppt(cpptText)}
                          className="h-7 text-xs text-slate-400 hover:text-amber-300"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Salin
                        </Button>
                      </div>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap bg-slate-900/80 p-3 rounded-lg border border-slate-800 max-h-60 overflow-y-auto">
                        {cpptText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Calculator className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Pilih Kalkulator Klinis</p>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Pilih salah satu dari 36+ kalkulator di panel sebelah kiri untuk menghitung dosis, indeks keparahan, atau koreksi elektrolit.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CdssExplorerModal;
