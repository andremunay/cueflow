/// <reference types="jest" />

const mockStorageState = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      mockStorageState.has(key) ? mockStorageState.get(key) ?? null : null
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorageState.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorageState.delete(key);
    }),
    clear: jest.fn(async () => {
      mockStorageState.clear();
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Routine } from '../src/types';
import { RoutineStorageError } from '../src/services/routineStorageErrors';
import {
  ROUTINE_STORAGE_KEY,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listRoutines,
  toggleFavorite,
  updateRoutine,
} from '../src/services/routineStorage';

const asyncStorageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function createRoutineFixture(id: string, overrides: Partial<Routine> = {}): Routine {
  return {
    id,
    name: `Routine ${id}`,
    tags: ['tag'],
    favorite: false,
    routineDurationMs: 60_000,
    startDelayMs: 3_000,
    headsUpEnabled: true,
    headsUpLeadTimeMs: 1_000,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [
      {
        id: `${id}-cue-1`,
        offsetMs: 5_000,
        actionType: 'tts',
        ttsText: 'start',
        headsUpOverride: 'inherit',
      },
    ],
    ...overrides,
  };
}

function expectStorageErrorCode(error: unknown, expectedCode: RoutineStorageError['code']): void {
  expect(error).toBeInstanceOf(RoutineStorageError);
  if (error instanceof RoutineStorageError) {
    expect(error.code).toBe(expectedCode);
  }
}

describe('routine storage service', () => {
  beforeEach(() => {
    mockStorageState.clear();
    jest.clearAllMocks();
  });

  it('supports create, get, and list operations', async () => {
    const alpha = createRoutineFixture('alpha');
    const beta = createRoutineFixture('beta', { favorite: true });

    await createRoutine(alpha);
    await createRoutine(beta);

    const list = await listRoutines();
    const fetchedAlpha = await getRoutine('alpha');

    expect(list.map((routine) => routine.id)).toEqual(['alpha', 'beta']);
    expect(fetchedAlpha).toEqual(alpha);
    expect(asyncStorageMock.setItem).toHaveBeenCalledTimes(2);
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      ROUTINE_STORAGE_KEY,
      expect.any(String)
    );
  });

  it('fails createRoutine when the routine id already exists', async () => {
    const alpha = createRoutineFixture('alpha');
    await createRoutine(alpha);

    await expect(createRoutine(alpha)).rejects.toMatchObject({
      code: 'DUPLICATE_ROUTINE_ID',
    });
  });

  it('updates an existing routine and fails update for missing ids', async () => {
    const alpha = createRoutineFixture('alpha');
    const beta = createRoutineFixture('beta');

    await createRoutine(alpha);
    await createRoutine(beta);

    const updatedBeta = await updateRoutine({
      ...beta,
      name: 'Updated Beta',
      favorite: true,
    });

    const list = await listRoutines();

    expect(updatedBeta.name).toBe('Updated Beta');
    expect(updatedBeta.favorite).toBe(true);
    expect(list.map((routine) => routine.id)).toEqual(['alpha', 'beta']);
    expect(list[1].name).toBe('Updated Beta');

    try {
      await updateRoutine(createRoutineFixture('missing'));
      throw new Error('Expected ROUTINE_NOT_FOUND error.');
    } catch (error) {
      expectStorageErrorCode(error, 'ROUTINE_NOT_FOUND');
    }
  });

  it('deletes existing routines and returns false for missing ids', async () => {
    const alpha = createRoutineFixture('alpha');
    await createRoutine(alpha);

    const deleted = await deleteRoutine('alpha');
    const deletedAgain = await deleteRoutine('alpha');
    const list = await listRoutines();

    expect(deleted).toBe(true);
    expect(deletedAgain).toBe(false);
    expect(list).toEqual([]);
  });

  it('toggles favorite and persists the updated value', async () => {
    const alpha = createRoutineFixture('alpha', { favorite: false });
    await createRoutine(alpha);

    const toggledOn = await toggleFavorite('alpha');
    const fetchedAfterToggle = await getRoutine('alpha');

    expect(toggledOn.favorite).toBe(true);
    expect(fetchedAfterToggle?.favorite).toBe(true);
  });

  it('keeps routine list order stable after update and favorite-toggle', async () => {
    const alpha = createRoutineFixture('alpha');
    const beta = createRoutineFixture('beta');
    const gamma = createRoutineFixture('gamma');

    await createRoutine(alpha);
    await createRoutine(beta);
    await createRoutine(gamma);

    await updateRoutine({ ...beta, name: 'Updated Beta' });
    await toggleFavorite('alpha');

    const list = await listRoutines();
    expect(list.map((routine) => routine.id)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('fails toggleFavorite for missing ids', async () => {
    try {
      await toggleFavorite('missing');
      throw new Error('Expected ROUTINE_NOT_FOUND error.');
    } catch (error) {
      expectStorageErrorCode(error, 'ROUTINE_NOT_FOUND');
    }
  });

  it('surfaces INVALID_STORAGE_FORMAT when persisted payload is unsupported', async () => {
    mockStorageState.set(
      ROUTINE_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        routines: [],
      })
    );

    try {
      await listRoutines();
      throw new Error('Expected INVALID_STORAGE_FORMAT error.');
    } catch (error) {
      expectStorageErrorCode(error, 'INVALID_STORAGE_FORMAT');
    }
  });
});
