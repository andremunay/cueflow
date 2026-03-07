import type { Routine } from '../types';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function filterRoutinesByQuery(routines: Routine[], query: string): Routine[] {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return routines;
  }

  return routines.filter((routine) => {
    const matchesName = routine.name.toLowerCase().includes(normalizedQuery);
    if (matchesName) {
      return true;
    }

    return routine.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
  });
}
