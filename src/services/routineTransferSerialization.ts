import { MAX_ROUTINE_DURATION_MS } from '../constants';
import type {
  Cue,
  CueActionType,
  HeadsUpOverride,
  Routine,
  RoutineExportWrapper,
  SoundId,
} from '../types';
import { RoutineTransferError } from './routineTransferErrors';

export const ROUTINE_EXPORT_VERSION = 1 as const;

const VALID_ACTION_TYPES: readonly CueActionType[] = ['tts', 'sound', 'combo'];
const VALID_HEADS_UP_OVERRIDES: readonly HeadsUpOverride[] = ['inherit', 'off', 'on'];
const VALID_SOUND_IDS: readonly SoundId[] = ['beep', 'chime', 'whistle'];
const WRAPPER_KEYS = new Set<string>(['version', 'routine']);
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function hasRequiredKeys(value: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((requiredKey) => Object.prototype.hasOwnProperty.call(value, requiredKey));
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

function isCue(value: unknown): value is Cue {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, CUE_KEYS) ||
    !hasRequiredKeys(value, ['id', 'offsetMs', 'actionType', 'headsUpOverride'])
  ) {
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

function isRoutine(value: unknown): value is Routine {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, ROUTINE_KEYS) ||
    !hasRequiredKeys(value, [
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
    ])
  ) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStringArray(value.tags) &&
    typeof value.favorite === 'boolean' &&
    isNonNegativeInteger(value.routineDurationMs) &&
    isNonNegativeInteger(value.startDelayMs) &&
    value.startDelayMs <= MAX_ROUTINE_DURATION_MS &&
    typeof value.headsUpEnabled === 'boolean' &&
    isNonNegativeInteger(value.headsUpLeadTimeMs) &&
    value.headsUpLeadTimeMs <= MAX_ROUTINE_DURATION_MS &&
    typeof value.hapticsEnabled === 'boolean' &&
    typeof value.duckPlannedFlag === 'boolean' &&
    Array.isArray(value.cues) &&
    value.cues.every((cue) => isCue(cue))
  );
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

function assertRoutineContent(routine: Routine): void {
  if (!hasUniqueCueIds(routine)) {
    throw new RoutineTransferError(
      'INVALID_ROUTINE_CONTENT',
      'Import file routine payload contains duplicate cue ids.'
    );
  }
}

export function createRoutineExportWrapper(routine: Routine): RoutineExportWrapper {
  if (!isRoutine(routine)) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Cannot export routine: routine payload has an invalid structure.'
    );
  }

  assertRoutineContent(routine);

  return {
    version: ROUTINE_EXPORT_VERSION,
    routine: cloneRoutine(routine),
  };
}

export function serializeRoutineExportWrapper(wrapper: RoutineExportWrapper): string {
  if (
    !isObjectRecord(wrapper) ||
    !hasOnlyAllowedKeys(wrapper, WRAPPER_KEYS) ||
    wrapper.version !== ROUTINE_EXPORT_VERSION ||
    !isRoutine(wrapper.routine)
  ) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Cannot export routine: routine payload has an invalid structure.'
    );
  }

  assertRoutineContent(wrapper.routine);

  return JSON.stringify({
    version: ROUTINE_EXPORT_VERSION,
    routine: cloneRoutine(wrapper.routine),
  });
}

export function deserializeRoutineExportWrapper(rawJson: string): RoutineExportWrapper {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new RoutineTransferError('INVALID_JSON', 'Selected file is not valid JSON.');
  }

  if (!isObjectRecord(parsed)) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Import file must contain an object with version and routine fields.'
    );
  }

  if (parsed.version !== ROUTINE_EXPORT_VERSION) {
    throw new RoutineTransferError(
      'UNSUPPORTED_EXPORT_VERSION',
      `Import file version is unsupported. Expected version ${ROUTINE_EXPORT_VERSION}.`
    );
  }

  if (
    !hasOnlyAllowedKeys(parsed, WRAPPER_KEYS) ||
    !Object.prototype.hasOwnProperty.call(parsed, 'routine')
  ) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Import file must contain only version and routine fields.'
    );
  }

  if (!isRoutine(parsed.routine)) {
    throw new RoutineTransferError(
      'INVALID_ROUTINE_CONTENT',
      'Import file routine payload has an invalid structure.'
    );
  }

  assertRoutineContent(parsed.routine);

  return {
    version: ROUTINE_EXPORT_VERSION,
    routine: cloneRoutine(parsed.routine),
  };
}
