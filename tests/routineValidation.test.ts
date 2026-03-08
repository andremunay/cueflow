/// <reference types="jest" />

import { MAX_CUE_COUNT, MAX_ROUTINE_DURATION_MS } from '../src/constants';
import { OVERLAP_WARNING_GAP_MS, validateRoutine } from '../src/utils';

interface CueInput {
  id: string;
  offsetMs: number;
}

function createCue(index: number, offsetMs: number): CueInput {
  return {
    id: `cue-${index}`,
    offsetMs,
  };
}

function createCues(count: number): CueInput[] {
  return Array.from({ length: count }, (_, index) => createCue(index, index * 1_000));
}

describe('validateRoutine', () => {
  it('returns no issues for a valid routine', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 5_000), createCue(1, 10_000)],
    });

    expect(result).toEqual({
      issues: [],
      hasErrors: false,
      hasWarnings: false,
    });
  });

  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, 1_000.5, 0, -1])(
    'returns MISSING_ROUTINE_DURATION for invalid required duration (%p)',
    (routineDurationMs) => {
      const result = validateRoutine({
        routineDurationMs,
        cues: [createCue(0, 2_000)],
      });

      const missingDurationIssues = result.issues.filter(
        (issue) => issue.code === 'MISSING_ROUTINE_DURATION'
      );

      expect(missingDurationIssues).toHaveLength(1);
      expect(result.hasErrors).toBe(true);
    }
  );

  it('returns DURATION_EXCEEDS_MAX when routine duration is above 2 hours', () => {
    const result = validateRoutine({
      routineDurationMs: MAX_ROUTINE_DURATION_MS + 1,
      cues: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DURATION_EXCEEDS_MAX', severity: 'error' }),
      ])
    );
    expect(result.hasErrors).toBe(true);
  });

  it('returns CUE_COUNT_EXCEEDS_MAX when cue count is above 200', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: createCues(MAX_CUE_COUNT + 1),
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CUE_COUNT_EXCEEDS_MAX', severity: 'error' }),
      ])
    );
    expect(result.hasErrors).toBe(true);
  });

  it('returns NEGATIVE_TIME for cues with negative offset values', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, -1), createCue(1, 5_000)],
    });

    const negativeIssues = result.issues.filter((issue) => issue.code === 'NEGATIVE_TIME');

    expect(negativeIssues).toHaveLength(1);
    expect(negativeIssues[0].path).toBe('cues[0].offsetMs');
    expect(result.hasErrors).toBe(true);
  });

  it('returns CUE_OUTSIDE_DURATION for cues later than routine duration', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 61_000), createCue(1, 80_000)],
    });

    const outOfRangeIssues = result.issues.filter((issue) => issue.code === 'CUE_OUTSIDE_DURATION');

    expect(outOfRangeIssues).toHaveLength(2);
    expect(outOfRangeIssues[0].path).toBe('cues[0].offsetMs');
    expect(outOfRangeIssues[1].path).toBe('cues[1].offsetMs');
    expect(result.hasErrors).toBe(true);
  });

  it('returns DUPLICATE_TIMESTAMP for each duplicate occurrence after the first', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 1_000), createCue(1, 1_000), createCue(2, 1_000)],
    });

    const duplicateIssues = result.issues.filter(
      (issue) => issue.code === 'DUPLICATE_TIMESTAMP'
    );

    expect(duplicateIssues).toHaveLength(2);
    expect(duplicateIssues[0].path).toBe('cues[1].offsetMs');
    expect(duplicateIssues[1].path).toBe('cues[2].offsetMs');
    expect(result.hasErrors).toBe(true);
  });

  it('returns OUT_OF_ORDER_CUES warnings for list-order regressions', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 1_000), createCue(1, 4_000), createCue(2, 3_000)],
    });

    const outOfOrderIssues = result.issues.filter((issue) => issue.code === 'OUT_OF_ORDER_CUES');

    expect(outOfOrderIssues).toHaveLength(1);
    expect(outOfOrderIssues[0].severity).toBe('warning');
    expect(outOfOrderIssues[0].path).toBe('cues[2].offsetMs');
  });

  it('returns OVERLAPPING_CUES warnings for chronological gaps under 3000ms and ignores duplicates', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [
        createCue(0, 0),
        createCue(1, OVERLAP_WARNING_GAP_MS - 1),
        createCue(2, 2 * OVERLAP_WARNING_GAP_MS - 1),
        createCue(3, 2 * OVERLAP_WARNING_GAP_MS - 1),
        createCue(4, 3 * OVERLAP_WARNING_GAP_MS - 500),
      ],
    });

    const overlapIssues = result.issues.filter((issue) => issue.code === 'OVERLAPPING_CUES');

    expect(overlapIssues).toHaveLength(2);
    expect(overlapIssues[0].path).toBe('cues[1].offsetMs');
    expect(overlapIssues[1].path).toBe('cues[4].offsetMs');
  });

  it('sets both hasErrors and hasWarnings when both severities are present', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 4_000), createCue(1, 3_000), createCue(2, 3_000)],
    });

    expect(result.hasErrors).toBe(true);
    expect(result.hasWarnings).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'DUPLICATE_TIMESTAMP',
      'OUT_OF_ORDER_CUES',
      'OVERLAPPING_CUES',
    ]);
  });

  it('allows warnings-only outcomes where hasErrors remains false', () => {
    const result = validateRoutine({
      routineDurationMs: 60_000,
      cues: [createCue(0, 7_000), createCue(1, 4_000), createCue(2, 1_000)],
    });

    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(true);
    expect(result.issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(['OUT_OF_ORDER_CUES', 'OUT_OF_ORDER_CUES']);
  });
});
