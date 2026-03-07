export type CueActionType = 'tts' | 'sound' | 'combo';

export type CueInputMode = 'elapsed' | 'countdown';

export type HeadsUpOverride = 'inherit' | 'off' | 'on';

export type SoundId = 'beep' | 'chime' | 'whistle';

export interface Cue {
  id: string;
  offsetMs: number;
  inputMode: CueInputMode;
  actionType: CueActionType;
  ttsText?: string;
  soundId?: SoundId;
  headsUpOverride: HeadsUpOverride;
}

export interface Routine {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  routineDurationMs: number;
  defaultHeadsUpEnabled: boolean;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  cues: Cue[];
}

export type ExportVersion = 1;

export interface RoutineExportWrapper {
  version: ExportVersion;
  routine: Routine;
}

export type ValidationSeverity = 'error' | 'warning';

export type ValidationCode =
  | 'NEGATIVE_TIME'
  | 'DUPLICATE_TIMESTAMP'
  | 'DURATION_EXCEEDS_MAX'
  | 'CUE_COUNT_EXCEEDS_MAX'
  | 'MISSING_ROUTINE_DURATION'
  | 'INVALID_COUNTDOWN_CONVERSION'
  | 'OVERLAPPING_CUES'
  | 'OUT_OF_ORDER_CUES';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: ValidationCode;
  message: string;
  path?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export type PlaybackStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

export interface PlaybackState {
  status: PlaybackStatus;
  routineId: string | null;
  routineStartTimeMs: number | null;
  pauseStartedAtMs: number | null;
  totalPausedMs: number;
  elapsedMs: number;
  nextCueIndex: number;
  lastExecutedCueId: string | null;
  firedCueIds: string[];
  firedHeadsUpCueIds: string[];
}
