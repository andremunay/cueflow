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
    startDelayMs: 3_000,
    headsUpEnabled: true,
    headsUpLeadTimeMs: 1_000,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [
      {
        id: `${id}-cue`,
        offsetMs: 5_000,
        actionType: 'tts',
        ttsText: 'start',
        headsUpOverride: 'on',
        headsUpLeadTimeMs: 2_000,
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

  it('rejects legacy routine arrays', () => {
    const legacyPayload = JSON.stringify([createRoutine('alpha')]);

    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot(legacyPayload));
  });

  it('rejects legacy wrappers without explicit version', () => {
    const legacyPayload = JSON.stringify({
      routines: [createRoutine('alpha')],
    });

    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot(legacyPayload));
  });

  it('rejects routines missing required current-schema fields', () => {
    const { startDelayMs: _removedStartDelay, ...legacyRoutine } = createRoutine('alpha');
    const payload = JSON.stringify({
      version: ROUTINE_STORAGE_VERSION,
      routines: [legacyRoutine],
    });

    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot(payload));
  });

  it('rejects routines containing legacy fields such as cue inputMode', () => {
    const payload = JSON.stringify({
      version: ROUTINE_STORAGE_VERSION,
      routines: [
        {
          ...createRoutine('alpha'),
          cues: [
            {
              id: 'cue-legacy',
              offsetMs: 5_000,
              inputMode: 'countdown',
              actionType: 'tts',
              ttsText: 'legacy',
              headsUpOverride: 'inherit',
            },
          ],
        },
      ],
    });

    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot(payload));
  });

  it('rejects routines containing legacy default heads-up alias', () => {
    const routine = createRoutine('alpha');
    const payload = JSON.stringify({
      version: ROUTINE_STORAGE_VERSION,
      routines: [
        {
          ...routine,
          defaultHeadsUpEnabled: routine.headsUpEnabled,
        },
      ],
    });

    expectInvalidStorageFormat(() => deserializeRoutineStorageSnapshot(payload));
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
