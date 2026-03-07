import type { Cue, CueActionType, CueInputMode, HeadsUpOverride, Routine, SoundId } from '../types';
import { RoutineStorageError } from './routineStorageErrors';

export const ROUTINE_STORAGE_VERSION = 1 as const;

export interface RoutineStorageSnapshotV1 {
  version: typeof ROUTINE_STORAGE_VERSION;
  routines: Routine[];
}

interface LegacyRoutineStorageSnapshot {
  routines: Routine[];
}

const VALID_INPUT_MODES: readonly CueInputMode[] = ['elapsed', 'countdown'];
const VALID_ACTION_TYPES: readonly CueActionType[] = ['tts', 'sound', 'combo'];
const VALID_HEADS_UP_OVERRIDES: readonly HeadsUpOverride[] = ['inherit', 'off', 'on'];
const VALID_SOUND_IDS: readonly SoundId[] = ['beep', 'chime', 'whistle'];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isCue(value: unknown): value is Cue {
  if (!isObjectRecord(value)) {
    return false;
  }

  const inputMode = value.inputMode;
  const actionType = value.actionType;
  const headsUpOverride = value.headsUpOverride;
  const soundId = value.soundId;

  return (
    typeof value.id === 'string' &&
    isFiniteInteger(value.offsetMs) &&
    VALID_INPUT_MODES.includes(inputMode as CueInputMode) &&
    VALID_ACTION_TYPES.includes(actionType as CueActionType) &&
    VALID_HEADS_UP_OVERRIDES.includes(headsUpOverride as HeadsUpOverride) &&
    isOptionalString(value.ttsText) &&
    (soundId === undefined || VALID_SOUND_IDS.includes(soundId as SoundId))
  );
}

function isRoutine(value: unknown): value is Routine {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.tags) &&
    typeof value.favorite === 'boolean' &&
    isFiniteInteger(value.routineDurationMs) &&
    typeof value.defaultHeadsUpEnabled === 'boolean' &&
    typeof value.hapticsEnabled === 'boolean' &&
    typeof value.duckPlannedFlag === 'boolean' &&
    Array.isArray(value.cues) &&
    value.cues.every((cue) => isCue(cue))
  );
}

function isRoutineArray(value: unknown): value is Routine[] {
  return Array.isArray(value) && value.every((item) => isRoutine(item));
}

function isLegacySnapshot(value: unknown): value is LegacyRoutineStorageSnapshot {
  if (!isObjectRecord(value)) {
    return false;
  }

  const hasVersion = Object.prototype.hasOwnProperty.call(value, 'version');
  const maybeRoutines = (value as { routines?: unknown }).routines;
  return !hasVersion && isRoutineArray(maybeRoutines);
}

function isV1Snapshot(value: unknown): value is RoutineStorageSnapshotV1 {
  if (!isObjectRecord(value)) {
    return false;
  }

  return value.version === ROUTINE_STORAGE_VERSION && isRoutineArray(value.routines);
}

function toInvalidStorageError(message: string): RoutineStorageError {
  return new RoutineStorageError('INVALID_STORAGE_FORMAT', message);
}

function cloneCue(cue: Cue): Cue {
  return { ...cue };
}

function cloneRoutine(routine: Routine): Routine {
  return {
    ...routine,
    tags: [...routine.tags],
    cues: routine.cues.map((cue) => cloneCue(cue)),
  };
}

function cloneRoutines(routines: Routine[]): Routine[] {
  return routines.map((routine) => cloneRoutine(routine));
}

export function createEmptyRoutineStorageSnapshot(): RoutineStorageSnapshotV1 {
  return {
    version: ROUTINE_STORAGE_VERSION,
    routines: [],
  };
}

export function serializeRoutineStorageSnapshot(snapshot: RoutineStorageSnapshotV1): string {
  if (!isV1Snapshot(snapshot)) {
    throw toInvalidStorageError('Cannot serialize routines: invalid v1 snapshot shape.');
  }

  return JSON.stringify({
    version: ROUTINE_STORAGE_VERSION,
    routines: cloneRoutines(snapshot.routines),
  });
}

export function deserializeRoutineStorageSnapshot(rawSnapshot: string | null): RoutineStorageSnapshotV1 {
  if (rawSnapshot === null) {
    return createEmptyRoutineStorageSnapshot();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSnapshot) as unknown;
  } catch {
    throw toInvalidStorageError('Stored routines payload is not valid JSON.');
  }

  if (isV1Snapshot(parsed)) {
    return {
      version: ROUTINE_STORAGE_VERSION,
      routines: cloneRoutines(parsed.routines),
    };
  }

  if (isRoutineArray(parsed)) {
    return {
      version: ROUTINE_STORAGE_VERSION,
      routines: cloneRoutines(parsed),
    };
  }

  if (isLegacySnapshot(parsed)) {
    return {
      version: ROUTINE_STORAGE_VERSION,
      routines: cloneRoutines(parsed.routines),
    };
  }

  throw toInvalidStorageError('Stored routines payload has an unsupported structure.');
}
