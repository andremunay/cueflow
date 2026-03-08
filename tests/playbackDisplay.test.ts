/// <reference types="jest" />

import { computeDisplayedElapsedMs, formatElapsedClockForDisplay } from '../src/utils';

describe('computeDisplayedElapsedMs', () => {
  it('returns persisted elapsed when playback is not running', () => {
    expect(
      computeDisplayedElapsedMs({
        status: 'paused',
        routineStartTimeMs: 10_000,
        totalPausedMs: 2_000,
        nowMs: 20_000,
        persistedElapsedMs: 5_000,
        routineDurationMs: 30_000,
      })
    ).toBe(5_000);
  });

  it('returns negative elapsed during pre-start delay and transitions to non-negative', () => {
    const baseParams = {
      status: 'running' as const,
      routineStartTimeMs: 10_000,
      totalPausedMs: 0,
      persistedElapsedMs: 0,
      routineDurationMs: 30_000,
    };

    expect(
      computeDisplayedElapsedMs({
        ...baseParams,
        nowMs: 7_000,
      })
    ).toBe(-3_000);
    expect(
      computeDisplayedElapsedMs({
        ...baseParams,
        nowMs: 10_000,
      })
    ).toBe(0);
    expect(
      computeDisplayedElapsedMs({
        ...baseParams,
        nowMs: 12_000,
      })
    ).toBe(2_000);
  });

  it('clamps running elapsed to routine duration', () => {
    expect(
      computeDisplayedElapsedMs({
        status: 'running',
        routineStartTimeMs: 0,
        totalPausedMs: 0,
        nowMs: 40_000,
        persistedElapsedMs: 0,
        routineDurationMs: 30_000,
      })
    ).toBe(30_000);
  });
});

describe('formatElapsedClockForDisplay', () => {
  it('formats negative elapsed as signed countdown clock values', () => {
    expect(formatElapsedClockForDisplay(-3_000)).toBe('-00:03');
    expect(formatElapsedClockForDisplay(-2_001)).toBe('-00:03');
    expect(formatElapsedClockForDisplay(-1_000)).toBe('-00:01');
  });

  it('formats zero and positive elapsed using clock format', () => {
    expect(formatElapsedClockForDisplay(0)).toBe('00:00');
    expect(formatElapsedClockForDisplay(1_000)).toBe('00:01');
    expect(formatElapsedClockForDisplay(65_000)).toBe('01:05');
  });
});
