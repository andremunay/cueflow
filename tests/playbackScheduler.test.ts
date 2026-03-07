/// <reference types="jest" />

import type { Cue } from '../src/types';
import {
  buildOrderedPlaybackCues,
  collectDuePlaybackEvents,
  computePlaybackElapsedMs,
  HEADS_UP_LEAD_TIME_MS,
} from '../src/services/playbackScheduler';

function createCue(id: string, offsetMs: number): Cue {
  return {
    id,
    offsetMs,
    inputMode: 'elapsed',
    actionType: 'tts',
    ttsText: `Cue ${id}`,
    headsUpOverride: 'inherit',
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
  it('fires heads-up exactly at t-3s', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('cue-1', 5_000)]);

    const dueAtThreshold = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 1_999,
      currentElapsedMs: 2_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(dueAtThreshold.events).toEqual([
      expect.objectContaining({
        type: 'headsUp',
        cueId: 'cue-1',
        targetElapsedMs: 2_000,
      }),
    ]);

    const afterThreshold = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 2_000,
      currentElapsedMs: 2_001,
      fired: {
        firedCueIds: dueAtThreshold.firedCueIds,
        firedHeadsUpCueIds: dueAtThreshold.firedHeadsUpCueIds,
      },
    });

    expect(afterThreshold.events).toEqual([]);
  });

  it('skips heads-up for cues earlier than 3 seconds', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('early', 2_500)]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: -1,
      currentElapsedMs: 3_000,
      fired: {
        firedCueIds: [],
        firedHeadsUpCueIds: [],
      },
    });

    expect(due.events).toEqual([
      expect.objectContaining({
        type: 'cue',
        cueId: 'early',
        targetElapsedMs: 2_500,
      }),
    ]);
    expect(due.firedHeadsUpCueIds).toEqual([]);
  });

  it('detects due events when a tick jumps over multiple trigger points', () => {
    const orderedCues = buildOrderedPlaybackCues([createCue('first', 5_000), createCue('second', 9_000)]);

    const due = collectDuePlaybackEvents({
      orderedCues,
      previousElapsedMs: 1_500,
      currentElapsedMs: 6_200,
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
