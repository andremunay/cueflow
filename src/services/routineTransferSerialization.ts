import type {
  Cue,
  CueActionType,
  CueInputMode,
  HeadsUpOverride,
  Routine,
  RoutineExportWrapper,
  SoundId,
} from '../types';
import { RoutineTransferError } from './routineTransferErrors';

export const ROUTINE_EXPORT_VERSION = 1 as const;

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

export function createRoutineExportWrapper(routine: Routine): RoutineExportWrapper {
  return {
    version: ROUTINE_EXPORT_VERSION,
    routine: cloneRoutine(routine),
  };
}

export function serializeRoutineExportWrapper(wrapper: RoutineExportWrapper): string {
  if (!isObjectRecord(wrapper)) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Cannot export routine: wrapper must be an object.'
    );
  }

  if (wrapper.version !== ROUTINE_EXPORT_VERSION) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      `Cannot export routine: version must be ${ROUTINE_EXPORT_VERSION}.`
    );
  }

  if (!isRoutine(wrapper.routine)) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Cannot export routine: routine payload has an invalid structure.'
    );
  }

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

  if (!Object.prototype.hasOwnProperty.call(parsed, 'routine')) {
    throw new RoutineTransferError(
      'INVALID_EXPORT_STRUCTURE',
      'Import file is missing the required routine field.'
    );
  }

  if (!isRoutine(parsed.routine)) {
    throw new RoutineTransferError(
      'INVALID_ROUTINE_CONTENT',
      'Import file routine payload has an invalid structure.'
    );
  }

  return {
    version: ROUTINE_EXPORT_VERSION,
    routine: cloneRoutine(parsed.routine),
  };
}
