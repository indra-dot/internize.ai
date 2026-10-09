import { describe, expect, it } from 'vitest';
import {
  GUIDELINE_SOURCES,
  PROTOCOL_SOURCE_IDS,
  getProtocolSources,
} from '../../src/services/clinical/guidelineSources';
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

  it('every protocol id in the mapping exists in the registry', () => {
    for (const id of Object.keys(PROTOCOL_SOURCE_IDS)) {
      expect(getProtocolById(id)).not.toBeNull();
    }
  });

  it('every source id in the mapping exists in GUIDELINE_SOURCES', () => {
    for (const ids of Object.values(PROTOCOL_SOURCE_IDS)) {
      for (const id of ids) {
        expect(GUIDELINE_SOURCES[id]).toBeDefined();
      }
    }
  });

  it('mapped protocols are not labelled internal', () => {
    for (const id of Object.keys(PROTOCOL_SOURCE_IDS)) {
      const protocol = getProtocolById(id);
      expect(protocol).not.toBeNull();
      expect(
        getProtocolSources(protocol as NonNullable<typeof protocol>).every(
          (s) => s.status !== 'internal',
        ),
      ).toBe(true);
    }
  });

  it('pre-op protocols are linked to the scores their text actually uses', () => {
    const preop = getProtocolById('preop-biasa');
    expect(preop).not.toBeNull();
    const ids = getProtocolSources(preop as NonNullable<typeof preop>).map((s) => s.id);
    expect(ids).toContain('ariscat');
    expect(ids).toContain('caprini');
    expect(ids).not.toContain('internal');
  });

  it('protocols with no verified source fall back to the internal label', () => {
    const unmatched = getAllProtocols().filter((p) =>
      getProtocolSources(p).every((s) => s.id === 'internal'),
    );
    expect(unmatched.length).toBeGreaterThan(0);
    for (const p of unmatched) {
      expect(getProtocolSources(p)).toEqual([GUIDELINE_SOURCES.internal]);
    }
  });
});
