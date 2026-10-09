import { describe, expect, it } from 'vitest';
import { GUIDELINE_SOURCES, getProtocolSources } from '../../src/services/clinical/guidelineSources';
import { getAllProtocols, getProtocolById } from '../../src/services/clinical/protocols';

describe('guideline sources', () => {
  it('every citation has a non-empty citation text and a valid status', () => {
    for (const src of Object.values(GUIDELINE_SOURCES)) {
      expect(src.citation.length).toBeGreaterThan(20);
      expect(['confirmed', 'partial', 'internal']).toContain(src.status);
    }
  });

  it('a partial citation always carries a note about what still needs checking', () => {
    for (const src of Object.values(GUIDELINE_SOURCES)) {
      if (src.status === 'partial') expect(src.note).toBeTruthy();
    }
  });

  it('pre-op protocols are linked to the scores their text actually uses', () => {
    const preop = getProtocolById('preop-biasa');
    expect(preop).not.toBeNull();
    const ids = getProtocolSources(preop!).map((s) => s.id);
    expect(ids).toContain('ariscat');
    expect(ids).toContain('caprini');
    expect(ids).not.toContain('internal');
  });

  it('protocols that cite no verified source fall back to the internal label', () => {
    const all = getAllProtocols();
    const unmatched = all.filter((p) => getProtocolSources(p).every((s) => s.id === 'internal'));
    expect(unmatched.length).toBeGreaterThan(0);
    for (const p of unmatched) {
      expect(getProtocolSources(p)).toEqual([GUIDELINE_SOURCES.internal]);
    }
  });
});
