import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Routine } from '../types';
import { RoutineStorageError } from './routineStorageErrors';
import {
  deserializeRoutineStorageSnapshot,
  serializeRoutineStorageSnapshot,
  type RoutineStorageSnapshotV1,
} from './routineStorageSerialization';

export const ROUTINE_STORAGE_KEY = '@cue-builder/routines';

function cloneRoutine(routine: Routine): Routine {
  return {
    ...routine,
    tags: [...routine.tags],
    cues: routine.cues.map((cue) => ({ ...cue })),
  };
}

function cloneRoutines(routines: Routine[]): Routine[] {
  return routines.map((routine) => cloneRoutine(routine));
}

async function readSnapshot(): Promise<RoutineStorageSnapshotV1> {
  const rawSnapshot = await AsyncStorage.getItem(ROUTINE_STORAGE_KEY);
  return deserializeRoutineStorageSnapshot(rawSnapshot);
}

async function writeSnapshot(snapshot: RoutineStorageSnapshotV1): Promise<void> {
  const serializedSnapshot = serializeRoutineStorageSnapshot(snapshot);
  await AsyncStorage.setItem(ROUTINE_STORAGE_KEY, serializedSnapshot);
}

function findRoutineIndexById(routines: Routine[], routineId: string): number {
  return routines.findIndex((routine) => routine.id === routineId);
}

function createNotFoundError(routineId: string): RoutineStorageError {
  return new RoutineStorageError('ROUTINE_NOT_FOUND', `Routine with id "${routineId}" was not found.`);
}

function createDuplicateError(routineId: string): RoutineStorageError {
  return new RoutineStorageError(
    'DUPLICATE_ROUTINE_ID',
    `Cannot create routine "${routineId}" because the id already exists.`
  );
}

export async function listRoutines(): Promise<Routine[]> {
  const snapshot = await readSnapshot();
  return cloneRoutines(snapshot.routines);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const snapshot = await readSnapshot();
  const routine = snapshot.routines.find((candidate) => candidate.id === id);
  return routine ? cloneRoutine(routine) : null;
}

export async function createRoutine(routine: Routine): Promise<Routine> {
  const snapshot = await readSnapshot();
  const existingIndex = findRoutineIndexById(snapshot.routines, routine.id);
  if (existingIndex !== -1) {
    throw createDuplicateError(routine.id);
  }

  const routineToInsert = cloneRoutine(routine);
  const nextSnapshot: RoutineStorageSnapshotV1 = {
    ...snapshot,
    routines: [...snapshot.routines, routineToInsert],
  };

  await writeSnapshot(nextSnapshot);
  return cloneRoutine(routineToInsert);
}

export async function updateRoutine(routine: Routine): Promise<Routine> {
  const snapshot = await readSnapshot();
  const existingIndex = findRoutineIndexById(snapshot.routines, routine.id);
  if (existingIndex === -1) {
    throw createNotFoundError(routine.id);
  }

  const updatedRoutine = cloneRoutine(routine);
  const nextRoutines = [...snapshot.routines];
  nextRoutines[existingIndex] = updatedRoutine;

  const nextSnapshot: RoutineStorageSnapshotV1 = {
    ...snapshot,
    routines: nextRoutines,
  };

  await writeSnapshot(nextSnapshot);
  return cloneRoutine(updatedRoutine);
}

export async function deleteRoutine(id: string): Promise<boolean> {
  const snapshot = await readSnapshot();
  const existingIndex = findRoutineIndexById(snapshot.routines, id);
  if (existingIndex === -1) {
    return false;
  }

  const nextRoutines = [...snapshot.routines];
  nextRoutines.splice(existingIndex, 1);

  const nextSnapshot: RoutineStorageSnapshotV1 = {
    ...snapshot,
    routines: nextRoutines,
  };

  await writeSnapshot(nextSnapshot);
  return true;
}

export async function toggleFavorite(id: string): Promise<Routine> {
  const snapshot = await readSnapshot();
  const existingIndex = findRoutineIndexById(snapshot.routines, id);
  if (existingIndex === -1) {
    throw createNotFoundError(id);
  }

  const existingRoutine = snapshot.routines[existingIndex];
  const updatedRoutine = cloneRoutine({
    ...existingRoutine,
    favorite: !existingRoutine.favorite,
  });

  const nextRoutines = [...snapshot.routines];
  nextRoutines[existingIndex] = updatedRoutine;

  const nextSnapshot: RoutineStorageSnapshotV1 = {
    ...snapshot,
    routines: nextRoutines,
  };

  await writeSnapshot(nextSnapshot);
  return cloneRoutine(updatedRoutine);
}
