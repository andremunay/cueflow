/// <reference types="jest" />

import type { Routine } from '../src/types';
import { filterRoutinesByQuery } from '../src/utils';

function createRoutineFixture(id: string, overrides: Partial<Routine> = {}): Routine {
  return {
    id,
    name: `Routine ${id}`,
    tags: [],
    favorite: false,
    routineDurationMs: 60_000,
    defaultHeadsUpEnabled: true,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [],
    ...overrides,
  };
}

describe('filterRoutinesByQuery', () => {
  it('matches routines by name', () => {
    const routines = [
      createRoutineFixture('one', { name: 'Morning Warmup' }),
      createRoutineFixture('two', { name: 'Evening Stretch' }),
    ];

    expect(filterRoutinesByQuery(routines, 'warm')).toEqual([routines[0]]);
  });

  it('matches routines by tags', () => {
    const routines = [
      createRoutineFixture('one', { tags: ['fitness', 'mobility'] }),
      createRoutineFixture('two', { tags: ['speech'] }),
    ];

    expect(filterRoutinesByQuery(routines, 'mobi')).toEqual([routines[0]]);
  });

  it('matches case-insensitively', () => {
    const routines = [createRoutineFixture('one', { name: 'Breathing Drill' })];

    expect(filterRoutinesByQuery(routines, 'breathing')).toEqual(routines);
    expect(filterRoutinesByQuery(routines, 'BREATHING')).toEqual(routines);
  });

  it('returns all routines for trimmed empty query', () => {
    const routines = [
      createRoutineFixture('one'),
      createRoutineFixture('two'),
      createRoutineFixture('three'),
    ];

    expect(filterRoutinesByQuery(routines, '')).toEqual(routines);
    expect(filterRoutinesByQuery(routines, '   ')).toEqual(routines);
  });

  it('returns an empty list when there are no matches', () => {
    const routines = [
      createRoutineFixture('one', { name: 'Upper Body' }),
      createRoutineFixture('two', { tags: ['legs'] }),
    ];

    expect(filterRoutinesByQuery(routines, 'balance')).toEqual([]);
  });
});
