/// <reference types="jest" />

import type { Routine } from '../src/types';
import { RoutineStorageError } from '../src/services/routineStorageErrors';
import {
  ROUTINE_STORAGE_VERSION,
  createEmptyRoutineStorageSnapshot,
  deserializeRoutineStorageSnapshot,
  serializeRoutineStorageSnapshot,
} from '../src/services/routineStorageSerialization';

function createRoutine(id: string): Routine {
  return {
    id,
    name: `Routine ${id}`,
    tags: ['test'],
    favorite: false,
    routineDurationMs: 60_000,
    defaultHeadsUpEnabled: true,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [
      {
        id: `${id}-cue`,
        offsetMs: 5_000,
        inputMode: 'elapsed',
        actionType: 'tts',
        ttsText: 'start',
        headsUpOverride: 'inherit',
      },
    ],
  };
}

function expectInvalidStorageFormat(testCase: () => void): void {
  try {
    testCase();
    throw new Error('Expected INVALID_STORAGE_FORMAT error.');
  } catch (error) {
    expect(error).toBeInstanceOf(RoutineStorageError);
    if (error instanceof RoutineStorageError) {
      expect(error.code).toBe('INVALID_STORAGE_FORMAT');
    }
  }
}

describe('routine storage serialization', () => {
  it('supports v1 round-trip serialization/deserialization', () => {
    const snapshot = {
      version: ROUTINE_STORAGE_VERSION,
      routines: [createRoutine('alpha')],
    };

    const serialized = serializeRoutineStorageSnapshot(snapshot);
    const deserialized = deserializeRoutineStorageSnapshot(serialized);

    expect(deserialized).toEqual(snapshot);
  });

  it('returns an empty v1 snapshot when storage is empty', () => {
    const snapshot = deserializeRoutineStorageSnapshot(null);

    expect(snapshot).toEqual(createEmptyRoutineStorageSnapshot());
  });

  it('migrates legacy routine arrays to v1 snapshot shape', () => {
    const legacyPayload = JSON.stringify([createRoutine('alpha'), createRoutine('beta')]);

    const snapshot = deserializeRoutineStorageSnapshot(legacyPayload);

    expect(snapshot).toEqual({
      version: ROUTINE_STORAGE_VERSION,
      routines: [createRoutine('alpha'), createRoutine('beta')],
    });
  });

  it('migrates legacy wrappers without version to v1 snapshot shape', () => {
    const legacyPayload = JSON.stringify({
      routines: [createRoutine('alpha')],
    });

    const snapshot = deserializeRoutineStorageSnapshot(legacyPayload);

    expect(snapshot).toEqual({
      version: ROUTINE_STORAGE_VERSION,
      routines: [createRoutine('alpha')],
    });
  });

  it('throws INVALID_STORAGE_FORMAT for invalid JSON or unsupported shapes', () => {
    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot('{bad json'));
    expectInvalidStorageFormat(() =>
      deserializeRoutineStorageSnapshot(
        JSON.stringify({
          version: ROUTINE_STORAGE_VERSION,
          routines: [{ id: 'invalid' }],
        })
      )
    );
  });
});
