import { MAX_ROUTINE_DURATION_MS } from '../constants';
import type { Cue, CueActionType, HeadsUpOverride, Routine, SoundId } from '../types';
import { RoutineStorageError } from './routineStorageErrors';

export const ROUTINE_STORAGE_VERSION = 1 as const;

export interface RoutineStorageSnapshotV1 {
  version: typeof ROUTINE_STORAGE_VERSION;
  routines: Routine[];
}

const VALID_ACTION_TYPES: readonly CueActionType[] = ['tts', 'sound', 'combo'];
const VALID_HEADS_UP_OVERRIDES: readonly HeadsUpOverride[] = ['inherit', 'off', 'on'];
const VALID_SOUND_IDS: readonly SoundId[] = ['beep', 'chime', 'whistle'];
const SNAPSHOT_KEYS = new Set<string>(['version', 'routines']);
const ROUTINE_KEYS = new Set<string>([
  'id',
  'name',
  'tags',
  'favorite',
  'routineDurationMs',
  'startDelayMs',
  'headsUpEnabled',
  'headsUpLeadTimeMs',
  'hapticsEnabled',
  'duckPlannedFlag',
  'cues',
]);
const CUE_KEYS = new Set<string>([
  'id',
  'offsetMs',
  'actionType',
  'ttsText',
  'soundId',
  'headsUpOverride',
  'headsUpLeadTimeMs',
]);

function createInvalidStorageFormatError(message: string): RoutineStorageError {
  return new RoutineStorageError('INVALID_STORAGE_FORMAT', message);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function hasCueRequiredFields(value: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(value, 'id') &&
    Object.prototype.hasOwnProperty.call(value, 'offsetMs') &&
    Object.prototype.hasOwnProperty.call(value, 'actionType') &&
    Object.prototype.hasOwnProperty.call(value, 'headsUpOverride')
  );
}

function isCue(value: unknown): value is Cue {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, CUE_KEYS) || !hasCueRequiredFields(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isNonNegativeInteger(value.offsetMs) &&
    VALID_ACTION_TYPES.includes(value.actionType as CueActionType) &&
    VALID_HEADS_UP_OVERRIDES.includes(value.headsUpOverride as HeadsUpOverride) &&
    (value.headsUpLeadTimeMs === undefined ||
      (isNonNegativeInteger(value.headsUpLeadTimeMs) &&
        value.headsUpLeadTimeMs <= MAX_ROUTINE_DURATION_MS)) &&
    isOptionalString(value.ttsText) &&
    (value.soundId === undefined || VALID_SOUND_IDS.includes(value.soundId as SoundId))
  );
}

function hasRoutineRequiredFields(value: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(value, 'id') &&
    Object.prototype.hasOwnProperty.call(value, 'name') &&
    Object.prototype.hasOwnProperty.call(value, 'tags') &&
    Object.prototype.hasOwnProperty.call(value, 'favorite') &&
    Object.prototype.hasOwnProperty.call(value, 'routineDurationMs') &&
    Object.prototype.hasOwnProperty.call(value, 'startDelayMs') &&
    Object.prototype.hasOwnProperty.call(value, 'headsUpEnabled') &&
    Object.prototype.hasOwnProperty.call(value, 'headsUpLeadTimeMs') &&
    Object.prototype.hasOwnProperty.call(value, 'hapticsEnabled') &&
    Object.prototype.hasOwnProperty.call(value, 'duckPlannedFlag') &&
    Object.prototype.hasOwnProperty.call(value, 'cues')
  );
}

function isRoutine(value: unknown): value is Routine {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ROUTINE_KEYS) || !hasRoutineRequiredFields(value)) {
    return false;
  }

  const startDelayMs = value.startDelayMs;
  const headsUpLeadTimeMs = value.headsUpLeadTimeMs;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.tags) &&
    typeof value.favorite === 'boolean' &&
    isNonNegativeInteger(value.routineDurationMs) &&
    isNonNegativeInteger(startDelayMs) &&
    startDelayMs <= MAX_ROUTINE_DURATION_MS &&
    typeof value.headsUpEnabled === 'boolean' &&
    isNonNegativeInteger(headsUpLeadTimeMs) &&
    headsUpLeadTimeMs <= MAX_ROUTINE_DURATION_MS &&
    typeof value.hapticsEnabled === 'boolean' &&
    typeof value.duckPlannedFlag === 'boolean' &&
    Array.isArray(value.cues) &&
    value.cues.every((cue) => isCue(cue))
  );
}

function isSnapshot(value: unknown): value is RoutineStorageSnapshotV1 {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    hasOnlyAllowedKeys(value, SNAPSHOT_KEYS) &&
    value.version === ROUTINE_STORAGE_VERSION &&
    Array.isArray(value.routines) &&
    value.routines.every((routine) => isRoutine(routine))
  );
}

function hasUniqueRoutineIds(routines: Routine[]): boolean {
  const seenRoutineIds = new Set<string>();

  for (const routine of routines) {
    if (seenRoutineIds.has(routine.id)) {
      return false;
    }

    seenRoutineIds.add(routine.id);
  }

  return true;
}

function hasUniqueCueIds(routine: Routine): boolean {
  const seenCueIds = new Set<string>();

  for (const cue of routine.cues) {
    if (seenCueIds.has(cue.id)) {
      return false;
    }

    seenCueIds.add(cue.id);
  }

  return true;
}

function cloneCue(cue: Cue): Cue {
  const clonedCue: Cue = {
    id: cue.id,
    offsetMs: cue.offsetMs,
    actionType: cue.actionType,
    headsUpOverride: cue.headsUpOverride,
  };

  if (cue.ttsText !== undefined) {
    clonedCue.ttsText = cue.ttsText;
  }

  if (cue.soundId !== undefined) {
    clonedCue.soundId = cue.soundId;
  }

  if (cue.headsUpLeadTimeMs !== undefined) {
    clonedCue.headsUpLeadTimeMs = cue.headsUpLeadTimeMs;
  }

  return clonedCue;
}

function cloneRoutine(routine: Routine): Routine {
  return {
    id: routine.id,
    name: routine.name,
    tags: [...routine.tags],
    favorite: routine.favorite,
    routineDurationMs: routine.routineDurationMs,
    startDelayMs: routine.startDelayMs,
    headsUpEnabled: routine.headsUpEnabled,
    headsUpLeadTimeMs: routine.headsUpLeadTimeMs,
    hapticsEnabled: routine.hapticsEnabled,
    duckPlannedFlag: routine.duckPlannedFlag,
    cues: routine.cues.map((cue) => cloneCue(cue)),
  };
}

function cloneSnapshot(snapshot: RoutineStorageSnapshotV1): RoutineStorageSnapshotV1 {
  return {
    version: ROUTINE_STORAGE_VERSION,
    routines: snapshot.routines.map((routine) => cloneRoutine(routine)),
  };
}

function assertSnapshotContent(snapshot: RoutineStorageSnapshotV1): void {
  if (!hasUniqueRoutineIds(snapshot.routines)) {
    throw createInvalidStorageFormatError('Stored routines contain duplicate routine ids.');
  }

  if (!snapshot.routines.every((routine) => hasUniqueCueIds(routine))) {
    throw createInvalidStorageFormatError('Stored routines contain duplicate cue ids.');
  }
}

export function createEmptyRoutineStorageSnapshot(): RoutineStorageSnapshotV1 {
  return {
    version: ROUTINE_STORAGE_VERSION,
    routines: [],
  };
}

export function serializeRoutineStorageSnapshot(snapshot: RoutineStorageSnapshotV1): string {
  if (!isSnapshot(snapshot)) {
    throw createInvalidStorageFormatError('Stored routines payload has an unsupported structure.');
  }

  assertSnapshotContent(snapshot);
  return JSON.stringify(cloneSnapshot(snapshot));
}

export function deserializeRoutineStorageSnapshot(rawSnapshot: string | null): RoutineStorageSnapshotV1 {
  if (rawSnapshot === null) {
    return createEmptyRoutineStorageSnapshot();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSnapshot) as unknown;
  } catch {
    throw createInvalidStorageFormatError('Stored routines payload is not valid JSON.');
  }

  if (!isSnapshot(parsed)) {
    throw createInvalidStorageFormatError('Stored routines payload has an unsupported structure.');
  }

  assertSnapshotContent(parsed);
  return cloneSnapshot(parsed);
}
