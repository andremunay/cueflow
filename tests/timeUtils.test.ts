/// <reference types="jest" />

import {
  formatCueTimeFromMs,
  normalizeCueOffsetMs,
  parseAndNormalizeCueOffsetMs,
  parseCueTimeToMs,
} from '../src/utils';

describe('parseCueTimeToMs', () => {
  it('parses mm:ss values', () => {
    expect(parseCueTimeToMs('05:30')).toEqual({ ok: true, value: 330_000 });
  });

  it('parses hh:mm:ss values', () => {
    expect(parseCueTimeToMs('01:05:30')).toEqual({ ok: true, value: 3_930_000 });
  });

  it('parses mm:ss values with large minutes', () => {
    expect(parseCueTimeToMs('120:00')).toEqual({ ok: true, value: 7_200_000 });
  });

  it('trims surrounding whitespace', () => {
    expect(parseCueTimeToMs(' 00:45 ')).toEqual({ ok: true, value: 45_000 });
  });

  it('returns INVALID_FORMAT for malformed time strings', () => {
    const result = parseCueTimeToMs('1:2:3:4');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_FORMAT');
    }
  });

  it('returns INVALID_FORMAT for non-numeric segments', () => {
    const result = parseCueTimeToMs('ab:10');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_FORMAT');
    }
  });

  it('returns INVALID_SEGMENT_RANGE when seconds exceed 59', () => {
    const result = parseCueTimeToMs('00:60');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SEGMENT_RANGE');
    }
  });

  it('returns INVALID_SEGMENT_RANGE when hh:mm:ss minutes exceed 59', () => {
    const result = parseCueTimeToMs('01:60:00');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SEGMENT_RANGE');
    }
  });
});

describe('formatCueTimeFromMs', () => {
  it('formats zero as mm:ss', () => {
    expect(formatCueTimeFromMs(0)).toEqual({ ok: true, value: '00:00' });
  });

  it('formats less than one hour as mm:ss', () => {
    expect(formatCueTimeFromMs(3_599_000)).toEqual({ ok: true, value: '59:59' });
  });

  it('formats one hour as hh:mm:ss', () => {
    expect(formatCueTimeFromMs(3_600_000)).toEqual({ ok: true, value: '01:00:00' });
  });

  it('formats over one hour as hh:mm:ss', () => {
    expect(formatCueTimeFromMs(7_200_000)).toEqual({ ok: true, value: '02:00:00' });
  });

  it('returns INVALID_MS for negative values', () => {
    const result = formatCueTimeFromMs(-1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_MS');
    }
  });

  it('returns INVALID_MS for non-whole-second values', () => {
    const result = formatCueTimeFromMs(1_500);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_MS');
    }
  });
});

describe('normalizeCueOffsetMs', () => {
  it('returns elapsed input unchanged when duration is not provided', () => {
    expect(normalizeCueOffsetMs({ inputMs: 45_000, inputMode: 'elapsed' })).toEqual({
      ok: true,
      value: 45_000,
    });
  });

  it('validates elapsed input against routine duration when provided', () => {
    expect(
      normalizeCueOffsetMs({
        inputMs: 60_000,
        inputMode: 'elapsed',
        routineDurationMs: 120_000,
      })
    ).toEqual({ ok: true, value: 60_000 });
  });

  it('returns OUT_OF_RANGE when elapsed input exceeds duration', () => {
    const result = normalizeCueOffsetMs({
      inputMs: 200_000,
      inputMode: 'elapsed',
      routineDurationMs: 120_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE');
    }
  });

  it('converts countdown input to elapsed offset', () => {
    expect(
      normalizeCueOffsetMs({
        inputMs: 30_000,
        inputMode: 'countdown',
        routineDurationMs: 120_000,
      })
    ).toEqual({ ok: true, value: 90_000 });
  });

  it('requires routine duration for countdown mode', () => {
    const result = normalizeCueOffsetMs({
      inputMs: 30_000,
      inputMode: 'countdown',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_ROUTINE_DURATION');
    }
  });

  it('returns OUT_OF_RANGE when countdown remaining exceeds duration', () => {
    const result = normalizeCueOffsetMs({
      inputMs: 90_000,
      inputMode: 'countdown',
      routineDurationMs: 60_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE');
    }
  });

  it('accepts countdown boundaries at 0 and routineDurationMs', () => {
    expect(
      normalizeCueOffsetMs({
        inputMs: 0,
        inputMode: 'countdown',
        routineDurationMs: 60_000,
      })
    ).toEqual({ ok: true, value: 60_000 });

    expect(
      normalizeCueOffsetMs({
        inputMs: 60_000,
        inputMode: 'countdown',
        routineDurationMs: 60_000,
      })
    ).toEqual({ ok: true, value: 0 });
  });
});

describe('parseAndNormalizeCueOffsetMs', () => {
  it('parses and normalizes countdown input in one pass', () => {
    expect(
      parseAndNormalizeCueOffsetMs({
        input: '00:30',
        inputMode: 'countdown',
        routineDurationMs: 120_000,
      })
    ).toEqual({ ok: true, value: 90_000 });
  });
});
