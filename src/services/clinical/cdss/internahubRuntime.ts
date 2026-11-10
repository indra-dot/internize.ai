/**
 * internahubRuntime.ts
 *
 * Universal Runtime Engine for 105+ drguswib InternaHub Calculators.
 * Bridges unstructured lab/EMR inputs into typed context, auto-calculates scores,
 * and generates 1-click seamless URL bridges to https://sites.google.com/view/drguswib/internahub
 */

import {
  parseFastTrackLabKeep,
  runInternaHubAutoCalc,
  type ParsedClinicalContext,
  type InternaHubAutoCalcResult,
} from './internahubAutoCalc';
import catalogData from './internahubCatalog.json';

export interface InternaHubCalcMeta {
  id: string;
  nama: string;
  divisi: string;
  tags: string;
  hasFields: boolean;
  hasMount: boolean;
}

export const INTERNAHUB_CALCULATORS: InternaHubCalcMeta[] = catalogData.calculators || [];

export const INTERNAHUB_BASE_URL = 'https://sites.google.com/view/drguswib/internahub';

/**
 * Builds a 1-click seamless import URL for drguswib/internahub (?data=base64#<calcId>)
 * Matches the native `urlImport` protocol of the Google Site.
 */
export function buildInternaHubBridgeUrl(
  ctx: ParsedClinicalContext,
  targetCalcId?: string
): string {
  const payload: Record<string, any> = {
    pasien: {
      usia: ctx.age,
      jenis_kelamin: ctx.sex,
      bb: ctx.bb,
      tb: ctx.tb,
    },
    tanda_vital: {
      sbp: ctx.sbp,
      dbp: ctx.dbp,
      nadi: ctx.hr,
      rr: ctx.rr,
      suhu: ctx.temp,
      spo2: ctx.spo2,
      gcs: ctx.gcs,
    },
    kimia: {
      bun: ctx.bun,
      ureum: ctx.ureum,
      kreatinin: ctx.cr,
      natrium: ctx.na,
      kalium: ctx.k,
      klorida: ctx.cl,
      kalsium: ctx.ca,
      albumin: ctx.alb,
      protein_total: ctx.prot,
      gds: ctx.glu,
      hba1c: ctx.hba1c,
      ast: ctx.ast,
      alt: ctx.alt,
      bilirubin: ctx.bili,
      alp: ctx.alp,
      ldh: ctx.ldh,
    },
    hematologi: {
      hb: ctx.hb,
      hct: ctx.hct,
      plt: ctx.plt,
      wbc: ctx.wbc,
      ne_abs: ctx.ne_abs,
      ly_abs: ctx.ly_abs,
      ppt: ctx.ppt,
      inr: ctx.inr,
      aptt: ctx.aptt,
      ddimer: ctx.ddimer,
      fib: ctx.fib,
    },
    agd: {
      ph: ctx.ph,
      pco2: ctx.pco2,
      hco3: ctx.hco3,
      po2: ctx.po2,
      lac: ctx.lac,
      fio2: ctx.fio2,
      be: ctx.be,
    },
  };

  // Clean empty/undefined keys
  for (const group of Object.keys(payload)) {
    for (const key of Object.keys(payload[group])) {
      if (payload[group][key] === undefined || payload[group][key] === null || isNaN(payload[group][key])) {
        delete payload[group][key];
      }
    }
  }

  const jsonStr = JSON.stringify(payload);
  const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
  const hashPart = targetCalcId ? `#${targetCalcId}` : '';

  return `${INTERNAHUB_BASE_URL}?data=${encodeURIComponent(base64Data)}${hashPart}`;
}

/**
 * Searches 105+ calculators using fuzzy keyword matching
 */
export function searchInternaHubCalculators(query: string): InternaHubCalcMeta[] {
  if (!query || !query.trim()) {
    return INTERNAHUB_CALCULATORS.slice(0, 20);
  }
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return INTERNAHUB_CALCULATORS.filter((c) => {
    const hay = `${c.id} ${c.nama} ${c.divisi} ${c.tags}`.toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}

export { parseFastTrackLabKeep, runInternaHubAutoCalc, type ParsedClinicalContext, type InternaHubAutoCalcResult };
