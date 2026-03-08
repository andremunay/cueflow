/// <reference types="jest" />

import type { Cue } from '../src/types';
import {
  buildOrderedPlaybackCues,
  collectDuePlaybackEvents,
  computePlaybackElapsedMs,
  HEADS_UP_LEAD_TIME_MS,
} from '../src/services/playbackScheduler';

function createCue(
  id: string,
  offsetMs: number,
  overrides: Partial<Pick<Cue, 'headsUpOverride' | 'headsUpLeadTimeMs'>> = {}
): Cue {
  return {
    id,
    offsetMs,
    actionType: 'tts',
    ttsText: `Cue ${id}`,
    headsUpOverride: 'inherit',
    ...overrides,
  };
}

describe('buildOrderedPlaybackCues', () => {
  it('sorts cues by offset with stable tie-break on original index', () => {
    const ordered = buildOrderedPlaybackCues([
      createCue('a', 5_000),
      createCue('b', 2_000),
      createCue('c', 5_000),
      createCue('d', 2_000),
    ]);

    expect(ordered.map((item) => item.cue.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(ordered.map((item) => item.sortedIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe('collectDuePlaybackEvents', () => {
  it('fires heads-up exactly at t-1s by default', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('cue-1', 5_000)]);

    const dueAtThreshold = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 3_999,
      currentElapsedMs: 4_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(dueAtThreshold.events).toEqual([
      expect.objectContaining({
        type: 'headsUp',
        cueId: 'cue-1',
        targetElapsedMs: 4_000,
      }),
    ]);
  });

  it('supports variable heads-up lead times', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('cue-1', 5_000)]);

    const dueAtTwoSeconds = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 2_999,
      currentElapsedMs: 3_000,
      headsUpLeadTimeMs: 2_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(dueAtTwoSeconds.events).toEqual([
      expect.objectContaining({
        type: 'headsUp',
        cueId: 'cue-1',
        targetElapsedMs: 3_000,
      }),
    ]);
  });

  it('suppresses all heads-up events when heads-up is disabled', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('cue-1', 5_000)]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 0,
      currentElapsedMs: 6_000,
      headsUpEnabled: false,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events).toEqual([
      expect.objectContaining({
        type: 'cue',
        cueId: 'cue-1',
        targetElapsedMs: 5_000,
      }),
    ]);
    expect(due.firedHeadsUpCueIds).toEqual([]);
  });

  it('fires cue heads-up when override is on even if routine heads-up is disabled', () => {
    const orderedCues = buildOrderedPlaybackCues([
      createCue('cue-1', 5_000, { headsUpOverride: 'on' }),
    ]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 3_999,
      currentElapsedMs: 4_000,
      headsUpEnabled: false,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events).toEqual([
      expect.objectContaining({
        type: 'headsUp',
        cueId: 'cue-1',
        targetElapsedMs: 4_000,
      }),
    ]);
  });

  it('uses cue-specific lead time when cue override is on', () => {
    const orderedCues = buildOrderedPlaybackCues([
      createCue('cue-1', 5_000, { headsUpOverride: 'on', headsUpLeadTimeMs: 2_000 }),
    ]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 2_999,
      currentElapsedMs: 3_000,
      headsUpEnabled: true,
      headsUpLeadTimeMs: 1_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events).toEqual([
      expect.objectContaining({
        type: 'headsUp',
        cueId: 'cue-1',
        targetElapsedMs: 3_000,
      }),
    ]);
  });

  it('detects due events when a tick jumps over multiple trigger points', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('first', 5_000), createCue('second', 9_000)]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 1_500,
      currentElapsedMs: 8_200,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events.map((event) => `${event.type}:${event.cueId}:${event.targetElapsedMs}`)).toEqual([
      `headsUp:first:${5_000 - HEADS_UP_LEAD_TIME_MS}`,
      'cue:first:5000',
      `headsUp:second:${9_000 - HEADS_UP_LEAD_TIME_MS}`,
    ]);
  });

  it('fires a zero-offset cue when playback reaches elapsed 00:00', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('zero', 0)]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: -1,
      currentElapsedMs: 0,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events).toEqual([
      expect.objectContaining({
        type: 'cue',
        cueId: 'zero',
        targetElapsedMs: 0,
      }),
    ]);
    expect(due.firedCueIds).toEqual(['zero']);
  });

  it('does not double-fire events after they have been marked fired', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('single', 6_000)]);

    const firstPass = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: -1,
      currentElapsedMs: 7_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(firstPass.events.map((event) => event.type)).toEqual(['headsUp', 'cue']);

    const secondPass = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 7_000,
      currentElapsedMs: 8_000,
      fired: {
        firedCueIds: firstPass.firedCueIds,
        firedHeadsUpCueIds: firstPass.firedHeadsUpCueIds,
      },
    });

    expect(secondPass.events).toEqual([]);
    expect(secondPass.firedCueIds).toEqual(firstPass.firedCueIds);
    expect(secondPass.firedHeadsUpCueIds).toEqual(firstPass.firedHeadsUpCueIds);
  });
});

describe('computePlaybackElapsedMs', () => {
  it('subtracts paused duration from elapsed time', () => {
    const elapsedMs = computePlaybackElapsedMs({
      routineStartTimeMs: 1_000,
      nowMs: 9_000,
      totalPausedMs: 2_500,
    });

    expect(elapsedMs).toBe(5_500);
  });

  it('clamps negative elapsed values to zero', () => {
    const elapsedMs = computePlaybackElapsedMs({
      routineStartTimeMs: 3_000,
      nowMs: 2_000,
      totalPausedMs: 0,
    });

    expect(elapsedMs).toBe(0);
  });
});
