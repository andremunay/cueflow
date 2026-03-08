import type { SoundId } from '../types';

export const MAX_ROUTINE_DURATION_MS = 7_200_000;
export const MAX_CUE_COUNT = 200;
export const PLAYBACK_TICK_INTERVAL_TARGET_MS = 150;
export const DEFAULT_ROUTINE_START_DELAY_MS = 3_000;
export const DEFAULT_HEADS_UP_LEAD_TIME_MS = 1_000;
export const SOUND_IDS = ['beep', 'chime', 'whistle'] as const satisfies readonly SoundId[];
