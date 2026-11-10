import type React from 'react';
import { useState, useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Search,
  Zap,
  Check,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  parseFastTrackLabKeep,
  runInternaHubAutoCalc,
  buildInternaHubBridgeUrl,
  searchInternaHubCalculators,
  type ParsedClinicalContext,
  type InternaHubAutoCalcResult,
  type InternaHubCalcMeta,
} from '../../services/clinical/cdss/internahubRuntime';

export interface InternaHubQuickBarProps {
  inputText: string;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenCdssExplorer?: (calcId?: string) => void;
}

export const InternaHubQuickBar: React.FC<InternaHubQuickBarProps> = ({
  inputText,
  onShowToast,
  onOpenCdssExplorer,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'keep' | 'cppt' | null>(null);

  // Parse patient context and calculate auto scores
  const ctx: ParsedClinicalContext = useMemo(() => {
    return parseFastTrackLabKeep(inputText);
  }, [inputText]);

  const autoCalcResult: InternaHubAutoCalcResult = useMemo(() => {
    return runInternaHubAutoCalc(ctx);
  }, [ctx]);

  const searchedCalcs: InternaHubCalcMeta[] = useMemo(() => {
    return searchInternaHubCalculators(searchQuery);
  }, [searchQuery]);

  const detectedParamsCount = useMemo(() => {
    return Object.keys(ctx).filter(
      (k) => k !== 'series' && k !== 'baseline' && (ctx as any)[k] !== undefined
    ).length;
  }, [ctx]);

  const bridgeUrl = useMemo(() => {
    return buildInternaHubBridgeUrl(ctx);
  }, [ctx]);

  const handleCopyKeep = () => {
    if (!autoCalcResult.keepSummary) {
      onShowToast?.('Belum ada hasil kalkulasi untuk disalin.', 'warning');
      return;
    }
    navigator.clipboard.writeText(autoCalcResult.keepSummary);
    setCopiedType('keep');
    setTimeout(() => setCopiedType(null), 2000);
    onShowToast?.('Hasil kalkulasi LabKeep disalin ke clipboard!', 'success');
  };

  const handleCopyCppt = () => {
    if (!autoCalcResult.cpptSummary) {
      onShowToast?.('Belum ada hasil kalkulasi untuk disalin.', 'warning');
      return;
    }
    navigator.clipboard.writeText(autoCalcResult.cpptSummary);
    setCopiedType('cppt');
    setTimeout(() => setCopiedType(null), 2000);
    onShowToast?.('Hasil kalkulasi format CPPT disalin ke clipboard!', 'success');
  };

  // If input is empty and no data detected, show compact prompt
  if (detectedParamsCount === 0 && !inputText.trim()) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-slate-900/95 shadow-xl overflow-hidden mb-4">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-amber-100">InternaHub Suite & Auto-Calculate</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                {detectedParamsCount} Parameter Terdeteksi
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {detectedParamsCount > 0 && (
            <a
              href={bridgeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-medium flex items-center gap-1 transition-all"
              title="Buka di web drguswib/internahub dengan seluruh data lab terisi otomatis"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">1-Klik ke Web InternaHub</span>
            </a>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* DETECTED PARAMS CHIPS */}
          {detectedParamsCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Parameter Aktif:</span>
              {ctx.age && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">Usia: {ctx.age} th</Badge>}
              {ctx.sex && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">JK: {ctx.sex === 'L' ? 'Pria' : 'Wanita'}</Badge>}
              {ctx.bb && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">BB: {ctx.bb} kg</Badge>}
              {ctx.sbp && ctx.dbp && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">TD: {ctx.sbp}/{ctx.dbp}</Badge>}
              {ctx.na && <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">Na: {ctx.na}</Badge>}
              {ctx.k && <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">K: {ctx.k}</Badge>}
              {ctx.cl && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">Cl: {ctx.cl}</Badge>}
              {ctx.ca && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">Ca: {ctx.ca}</Badge>}
              {ctx.glu && <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">GDS: {ctx.glu}</Badge>}
              {ctx.cr && <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">SCr: {ctx.cr}</Badge>}
              {ctx.ureum && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">Ureum: {ctx.ureum}</Badge>}
              {ctx.hb && <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">Hb: {ctx.hb}</Badge>}
              {ctx.plt && <Badge variant="outline" className="text-[10px] bg-slate-800 text-amber-300 border-slate-700">PLT: {ctx.plt}</Badge>}
              {ctx.ph && <Badge variant="outline" className="text-[10px] bg-slate-800 text-rose-300 border-slate-700">pH: {ctx.ph}</Badge>}
              {ctx.hco3 && <Badge variant="outline" className="text-[10px] bg-slate-800 text-rose-300 border-slate-700">HCO3: {ctx.hco3}</Badge>}
            </div>
          )}

          {/* AUTO-CALCULATE SCORES GRID */}
          {autoCalcResult.scores.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Kalkulasi Otomatis Instan ({autoCalcResult.scores.length} Skor Terhitung)
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyKeep}
                    className="h-7 text-[11px] text-slate-300 hover:text-white"
                  >
                    {copiedType === 'keep' ? <Check className="w-3 h-3 text-emerald-400 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Salin LabKeep
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyCppt}
                    className="h-7 text-[11px] text-slate-300 hover:text-white"
                  >
                    {copiedType === 'cppt' ? <Check className="w-3 h-3 text-emerald-400 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Salin CPPT
                  </Button>
                </div>
              </div>

              {/* CRITICAL ALERTS */}
              {autoCalcResult.alerts.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs space-y-1">
                  {autoCalcResult.alerts.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">!</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* SCORES CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {autoCalcResult.scores.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onOpenCdssExplorer?.(s.calcId)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
                      s.status === 'bad'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-100 hover:border-rose-400'
                        : s.status === 'warn'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-100 hover:border-amber-400'
                        : 'bg-slate-950/50 border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{s.group}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        s.status === 'bad' ? 'bg-rose-500 text-slate-950' : s.status === 'warn' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {s.status === 'bad' ? 'Kritis' : s.status === 'warn' ? 'Perhatian' : 'Normal'}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-white truncate">{s.name}</div>
                    <div className="text-base font-extrabold text-amber-300 my-0.5">{s.value}</div>
                    <div className="text-[11px] text-slate-300 line-clamp-1">{s.interpretation}</div>
                    {s.subvalue && <div className="text-[10px] text-slate-500 mt-1 truncate">{s.subvalue}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SMART INTENT SELECTOR: "MAU CARI / HITUNG APA?" */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-400" />
                Mau Hitung Apa? (105+ Kalkulator InternaHub Auto-Prefilled)
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenCdssExplorer?.()}
                className="h-7 text-xs border-slate-700 text-slate-300 hover:text-white"
              >
                <span>Buka Katalog Lengkap</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kalkulator (misal: kalium, meropenem, syringe pump, gbs, ctp, agd, dka)..."
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {searchQuery.trim() && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {searchedCalcs.map((calc) => (
                  <div
                    key={calc.id}
                    onClick={() => onOpenCdssExplorer?.(calc.id)}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{calc.nama}</div>
                      <div className="text-[10px] text-slate-400">{calc.divisi}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
