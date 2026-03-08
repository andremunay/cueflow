import { formatCueTimeFromMs, parseCueTimeToMs } from './time';

export type ExpandedCueIdMap = Record<string, true>;

const COLLAPSED_CUE_TIME_PLACEHOLDER = '--:--';

export function createExpandedCueStateForAddedCue(cueId: string): ExpandedCueIdMap {
  return {
    [cueId]: true,
  };
}

export function toggleCueExpandedState(
  expandedCueIds: ExpandedCueIdMap,
  cueId: string
): ExpandedCueIdMap {
  if (expandedCueIds[cueId]) {
    const nextExpandedCueIds = { ...expandedCueIds };
    delete nextExpandedCueIds[cueId];
    return nextExpandedCueIds;
  }

  return {
    ...expandedCueIds,
    [cueId]: true,
  };
}

export function getCollapsedCueTimeLabel(timeText: string): string {
  const parsed = parseCueTimeToMs(timeText);
  if (!parsed.ok) {
    return COLLAPSED_CUE_TIME_PLACEHOLDER;
  }

  const formatted = formatCueTimeFromMs(parsed.value);
  if (!formatted.ok) {
    return COLLAPSED_CUE_TIME_PLACEHOLDER;
  }

  return formatted.value;
}
