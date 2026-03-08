import type { PlaybackState } from '../types';
import { formatCueTimeFromMs } from './time';

const MILLISECONDS_PER_SECOND = 1_000;

export interface ComputeDisplayedElapsedMsParams {
  status: PlaybackState['status'];
  routineStartTimeMs: number | null;
  totalPausedMs: number;
  nowMs: number;
  persistedElapsedMs: number;
  routineDurationMs: number;
}

export function computeDisplayedElapsedMs(params: ComputeDisplayedElapsedMsParams): number {
  if (params.status !== 'running' || params.routineStartTimeMs === null) {
    return params.persistedElapsedMs;
  }

  const rawElapsedMs = params.nowMs - params.routineStartTimeMs - params.totalPausedMs;
  if (rawElapsedMs < 0) {
    return rawElapsedMs;
  }

  return Math.min(rawElapsedMs, params.routineDurationMs);
}

export function formatElapsedClockForDisplay(ms: number): string {
  if (!Number.isFinite(ms)) {
    return '00:00';
  }

  if (ms < 0) {
    const roundedCountdownMs =
      Math.ceil(Math.abs(ms) / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;
    const formattedCountdown = formatCueTimeFromMs(roundedCountdownMs);
    return formattedCountdown.ok ? `-${formattedCountdown.value}` : '-00:00';
  }

  const roundedMs = Math.floor(ms / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;
  const formatted = formatCueTimeFromMs(roundedMs);
  return formatted.ok ? formatted.value : '00:00';
}
