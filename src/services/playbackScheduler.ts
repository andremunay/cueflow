import type { Cue } from '../types';
import { DEFAULT_HEADS_UP_LEAD_TIME_MS } from '../constants';

export const HEADS_UP_LEAD_TIME_MS = DEFAULT_HEADS_UP_LEAD_TIME_MS;

export type PlaybackDueEventType = 'headsUp' | 'cue';

export interface OrderedPlaybackCue {
  cue: Cue;
  originalIndex: number;
  sortedIndex: number;
}

export interface PlaybackDueEvent {
  type: PlaybackDueEventType;
  cue: Cue;
  cueId: string;
  cueSortedIndex: number;
  targetElapsedMs: number;
}

export interface PlaybackFiredStateSnapshot {
  firedCueIds: string[];
  firedHeadsUpCueIds: string[];
}

export interface ComputePlaybackElapsedMsParams {
  routineStartTimeMs: number;
  nowMs: number;
  totalPausedMs: number;
}

export interface CollectDuePlaybackEventsParams {
  orderedCues: OrderedPlaybackCue[];
  previousElapsedMs: number;
  currentElapsedMs: number;
  headsUpEnabled?: boolean;
  headsUpLeadTimeMs?: number;
  fired: PlaybackFiredStateSnapshot;
}

export interface CollectDuePlaybackEventsResult extends PlaybackFiredStateSnapshot {
  events: PlaybackDueEvent[];
}

function sanitizeCurrentElapsedMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value < 0 ? 0 : value;
}

function sanitizePreviousElapsedMs(value: number): number {
  if (!Number.isFinite(value)) {
    return -1;
  }

  if (value < -1) {
    return -1;
  }

  return value;
}

function sanitizeHeadsUpLeadTimeMs(value: number | undefined): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return HEADS_UP_LEAD_TIME_MS;
  }

  return value;
}

function isHeadsUpEnabledForCue(cue: Cue, routineHeadsUpEnabled: boolean): boolean {
  if (cue.headsUpOverride === 'on') {
    return true;
  }

  if (cue.headsUpOverride === 'off') {
    return false;
  }

  return routineHeadsUpEnabled;
}

function resolveCueHeadsUpLeadTimeMs(cue: Cue, routineHeadsUpLeadTimeMs: number): number {
  if (cue.headsUpOverride !== 'on') {
    return routineHeadsUpLeadTimeMs;
  }

  const cueLeadTimeMs = cue.headsUpLeadTimeMs;
  if (
    typeof cueLeadTimeMs !== 'number' ||
    !Number.isFinite(cueLeadTimeMs) ||
    !Number.isInteger(cueLeadTimeMs) ||
    cueLeadTimeMs < 0
  ) {
    return routineHeadsUpLeadTimeMs;
  }

  return cueLeadTimeMs;
}

function isDueWithinRange(triggerMs: number, previousElapsedMs: number, currentElapsedMs: number): boolean {
  if (currentElapsedMs <= previousElapsedMs) {
    return false;
  }

  return triggerMs > previousElapsedMs && triggerMs <= currentElapsedMs;
}

export function buildOrderedPlaybackCues(cues: Cue[]): OrderedPlaybackCue[] {
  return cues
    .map((cue, originalIndex) => ({ cue, originalIndex }))
    .sort((left, right) => {
      const byOffset = left.cue.offsetMs - right.cue.offsetMs;
      if (byOffset !== 0) {
        return byOffset;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map((item, sortedIndex) => ({
      cue: item.cue,
      originalIndex: item.originalIndex,
      sortedIndex,
    }));
}

export function computePlaybackElapsedMs(params: ComputePlaybackElapsedMsParams): number {
  const elapsedMs = params.nowMs - params.routineStartTimeMs - params.totalPausedMs;
  return sanitizeCurrentElapsedMs(elapsedMs);
}

export function findNextCueSortedIndex(
  orderedCues: OrderedPlaybackCue[],
  firedCueIds: readonly string[]
): number {
  const firedCueIdsSet = new Set(firedCueIds);
  const nextCue = orderedCues.find(({ cue }) => !firedCueIdsSet.has(cue.id));
  return nextCue ? nextCue.sortedIndex : -1;
}

export function collectDuePlaybackEvents(
  params: CollectDuePlaybackEventsParams
): CollectDuePlaybackEventsResult {
  const previousElapsedMs = sanitizePreviousElapsedMs(params.previousElapsedMs);
  const currentElapsedMs = sanitizeCurrentElapsedMs(params.currentElapsedMs);
  const routineHeadsUpEnabled = params.headsUpEnabled ?? true;
  const routineHeadsUpLeadTimeMs = sanitizeHeadsUpLeadTimeMs(params.headsUpLeadTimeMs);
  const firedCueIdsSet = new Set(params.fired.firedCueIds);
  const firedHeadsUpCueIdsSet = new Set(params.fired.firedHeadsUpCueIds);
  const events: PlaybackDueEvent[] = [];

  for (const orderedCue of params.orderedCues) {
    const cueId = orderedCue.cue.id;
    const cueOffsetMs = orderedCue.cue.offsetMs;

    const cueHeadsUpEnabled = isHeadsUpEnabledForCue(orderedCue.cue, routineHeadsUpEnabled);
    const cueHeadsUpLeadTimeMs = resolveCueHeadsUpLeadTimeMs(
      orderedCue.cue,
      routineHeadsUpLeadTimeMs
    );

    if (
      cueHeadsUpEnabled &&
      !firedHeadsUpCueIdsSet.has(cueId) &&
      cueOffsetMs >= cueHeadsUpLeadTimeMs
    ) {
      const headsUpTriggerMs = cueOffsetMs - cueHeadsUpLeadTimeMs;
      if (isDueWithinRange(headsUpTriggerMs, previousElapsedMs, currentElapsedMs)) {
        firedHeadsUpCueIdsSet.add(cueId);
        events.push({
          type: 'headsUp',
          cue: orderedCue.cue,
          cueId,
          cueSortedIndex: orderedCue.sortedIndex,
          targetElapsedMs: headsUpTriggerMs,
        });
      }
    }

    if (!firedCueIdsSet.has(cueId) && isDueWithinRange(cueOffsetMs, previousElapsedMs, currentElapsedMs)) {
      firedCueIdsSet.add(cueId);
      events.push({
        type: 'cue',
        cue: orderedCue.cue,
        cueId,
        cueSortedIndex: orderedCue.sortedIndex,
        targetElapsedMs: cueOffsetMs,
      });
    }
  }

  events.sort((left, right) => {
    const byTargetElapsed = left.targetElapsedMs - right.targetElapsedMs;
    if (byTargetElapsed !== 0) {
      return byTargetElapsed;
    }

    if (left.type !== right.type) {
      return left.type === 'headsUp' ? -1 : 1;
    }

    return left.cueSortedIndex - right.cueSortedIndex;
  });

  return {
    events,
    firedCueIds: Array.from(firedCueIdsSet),
    firedHeadsUpCueIds: Array.from(firedHeadsUpCueIdsSet),
  };
}
