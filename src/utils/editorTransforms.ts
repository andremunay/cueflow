import type {
  Cue,
  CueActionType,
  HeadsUpOverride,
  Routine,
  SoundId,
  ValidationIssue,
} from '../types';
import { DEFAULT_HEADS_UP_LEAD_TIME_MS, MAX_ROUTINE_DURATION_MS } from '../constants';
import { formatCueTimeFromMs, parseAndNormalizeCueOffsetMs, parseCueTimeToMs } from './time';
import { validateRoutine } from './validation';

export interface EditorCueDraftInput {
  id: string;
  timeText: string;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
  headsUpLeadTimeText: string;
}

export interface NormalizedEditorCue {
  id: string;
  offsetMs: number;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
  headsUpLeadTimeMs?: number;
}

export interface EditorIssueMessage {
  severity: 'error' | 'warning';
  message: string;
}

export interface EditorIssueBuckets {
  durationErrorText?: string;
  startDelayErrorText?: string;
  headsUpLeadTimeErrorText?: string;
  cueTimeErrorById: Record<string, string>;
  cueHeadsUpLeadTimeErrorById: Record<string, string>;
  cueTimeWarningById: Record<string, string>;
  routineMessages: EditorIssueMessage[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface EvaluateEditorDraftParams {
  routineDurationText: string;
  startDelayText: string;
  headsUpEnabled: boolean;
  headsUpLeadTimeText: string;
  cues: EditorCueDraftInput[];
}

export interface EvaluateEditorDraftResult {
  routineDurationMs: number | null;
  startDelayMs: number | null;
  headsUpLeadTimeMs: number | null;
  normalizedCues: NormalizedEditorCue[];
  issues: EditorIssueBuckets;
}

export interface BuildRoutineSavePayloadParams {
  mode: 'create' | 'update';
  routineId?: string;
  routineName: string;
  tagsText: string;
  favorite: boolean;
  routineDurationMs: number;
  startDelayMs: number;
  headsUpEnabled: boolean;
  headsUpLeadTimeMs: number;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  normalizedCues: NormalizedEditorCue[];
  idFactory?: () => string;
}

export interface BuildRoutineSavePayloadResult {
  operation: 'create' | 'update';
  routine: Routine;
}

export interface AutoOrderCueDraftsParams<
  TCueDraft extends Pick<EditorCueDraftInput, 'timeText'>,
> {
  cues: readonly TCueDraft[];
  routineDurationText: string;
}

const CUE_OFFSET_PATH_REGEX = /^cues\[(\d+)\]\.offsetMs$/;
const DEFAULT_TIME_TEXT = '00:00';

function parseCueOffsetPath(path: string | undefined): number | null {
  if (!path) {
    return null;
  }

  const match = CUE_OFFSET_PATH_REGEX.exec(path);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function cueToPersistedCue(cue: NormalizedEditorCue): Cue {
  const persistedCue: Cue = {
    id: cue.id,
    offsetMs: cue.offsetMs,
    actionType: cue.actionType,
    headsUpOverride: cue.headsUpOverride,
  };

  if (cue.actionType === 'tts' || cue.actionType === 'combo') {
    persistedCue.ttsText = cue.ttsText;
  }

  if (cue.actionType === 'sound' || cue.actionType === 'combo') {
    persistedCue.soundId = cue.soundId;
  }

  if (cue.headsUpOverride === 'on' && cue.headsUpLeadTimeMs !== undefined) {
    persistedCue.headsUpLeadTimeMs = cue.headsUpLeadTimeMs;
  }

  return persistedCue;
}

function formatIssueFromValidation(issue: ValidationIssue): EditorIssueMessage {
  return {
    severity: issue.severity,
    message: issue.message,
  };
}

function parseRoutineDurationTextToMsOrUndefined(routineDurationText: string): number | undefined {
  const parsedRoutineDuration = parseCueTimeToMs(routineDurationText);
  return parsedRoutineDuration.ok ? parsedRoutineDuration.value : undefined;
}

function tryParseNormalizedCueOffsetMs(
  cue: Pick<EditorCueDraftInput, 'timeText'>,
  routineDurationMs: number | undefined
): number | null {
  const parsedOffset = parseAndNormalizeCueOffsetMs({
    input: cue.timeText,
    routineDurationMs,
  });

  if (!parsedOffset.ok) {
    return null;
  }

  return parsedOffset.value;
}

export function autoOrderCueDraftsByNormalizedElapsed<
  TCueDraft extends Pick<EditorCueDraftInput, 'timeText'>,
>(params: AutoOrderCueDraftsParams<TCueDraft>): TCueDraft[] {
  if (params.cues.length < 2) {
    return [...params.cues];
  }

  const routineDurationMs = parseRoutineDurationTextToMsOrUndefined(params.routineDurationText);
  const indexedCues = params.cues.map((cue, originalIndex) => ({
    cue,
    originalIndex,
    normalizedOffsetMs: tryParseNormalizedCueOffsetMs(cue, routineDurationMs),
  }));
  const sortedValidCues = indexedCues
    .filter((indexedCue): indexedCue is typeof indexedCue & { normalizedOffsetMs: number } => {
      return indexedCue.normalizedOffsetMs !== null;
    })
    .sort((left, right) => {
      const byOffset = left.normalizedOffsetMs - right.normalizedOffsetMs;
      if (byOffset !== 0) {
        return byOffset;
      }

      return left.originalIndex - right.originalIndex;
    });

  if (sortedValidCues.length < 2) {
    return [...params.cues];
  }

  let sortedValidCueIndex = 0;
  const nextCues = indexedCues.map((indexedCue) => {
    if (indexedCue.normalizedOffsetMs === null) {
      return indexedCue.cue;
    }

    const sortedCue = sortedValidCues[sortedValidCueIndex];
    sortedValidCueIndex += 1;
    return sortedCue.cue;
  });

  return nextCues;
}

export function parseTagsText(tagsText: string): string[] {
  const seen = new Set<string>();
  const parsedTags: string[] = [];

  tagsText
    .split(',')
    .map((tag) => tag.trim())
    .forEach((tag) => {
      if (tag.length === 0) {
        return;
      }

      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      parsedTags.push(tag);
    });

  return parsedTags;
}

export function createGeneratedRoutineId(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `routine-${Date.now()}-${randomSuffix}`;
}

export function toEditorCueTimeText(
  offsetMs: number
): string {
  const safeInputMs = offsetMs < 0 ? 0 : offsetMs;
  const formatted = formatCueTimeFromMs(safeInputMs);
  return formatted.ok ? formatted.value : DEFAULT_TIME_TEXT;
}

export function evaluateEditorDraft(params: EvaluateEditorDraftParams): EvaluateEditorDraftResult {
  const cueTimeErrorById: Record<string, string> = {};
  const cueHeadsUpLeadTimeErrorById: Record<string, string> = {};
  const cueTimeWarningById: Record<string, string> = {};
  const routineMessages: EditorIssueMessage[] = [];
  const normalizedCues: NormalizedEditorCue[] = [];

  const parsedDuration = parseCueTimeToMs(params.routineDurationText);
  const routineDurationMs = parsedDuration.ok ? parsedDuration.value : null;
  const durationErrorText = parsedDuration.ok ? undefined : parsedDuration.error.message;
  const parsedStartDelay = parseCueTimeToMs(params.startDelayText);
  let startDelayMs = parsedStartDelay.ok ? parsedStartDelay.value : null;
  let startDelayErrorText = parsedStartDelay.ok ? undefined : parsedStartDelay.error.message;

  if (startDelayMs !== null && startDelayMs > MAX_ROUTINE_DURATION_MS) {
    startDelayMs = null;
    startDelayErrorText = `Start delay cannot exceed ${MAX_ROUTINE_DURATION_MS} milliseconds.`;
  }

  const parsedHeadsUpLeadTime = parseCueTimeToMs(params.headsUpLeadTimeText);
  let headsUpLeadTimeMs = params.headsUpEnabled ? null : DEFAULT_HEADS_UP_LEAD_TIME_MS;
  let headsUpLeadTimeErrorText: string | undefined;

  if (params.headsUpEnabled) {
    if (!parsedHeadsUpLeadTime.ok) {
      headsUpLeadTimeErrorText = parsedHeadsUpLeadTime.error.message;
    } else if (parsedHeadsUpLeadTime.value > MAX_ROUTINE_DURATION_MS) {
      headsUpLeadTimeErrorText = `Heads-up lead time cannot exceed ${MAX_ROUTINE_DURATION_MS} milliseconds.`;
    } else {
      headsUpLeadTimeMs = parsedHeadsUpLeadTime.value;
    }
  }

  params.cues.forEach((cue) => {
    const normalizedCueOffset = parseAndNormalizeCueOffsetMs({
      input: cue.timeText,
      routineDurationMs: routineDurationMs ?? undefined,
    });

    if (!normalizedCueOffset.ok) {
      cueTimeErrorById[cue.id] = normalizedCueOffset.error.message;
      return;
    }

    let cueHeadsUpLeadTimeMs: number | undefined;
    if (cue.headsUpOverride === 'on') {
      const parsedCueHeadsUpLeadTime = parseCueTimeToMs(cue.headsUpLeadTimeText);
      if (!parsedCueHeadsUpLeadTime.ok) {
        cueHeadsUpLeadTimeErrorById[cue.id] = parsedCueHeadsUpLeadTime.error.message;
        return;
      }

      if (parsedCueHeadsUpLeadTime.value > MAX_ROUTINE_DURATION_MS) {
        cueHeadsUpLeadTimeErrorById[cue.id] =
          `Heads-up lead time cannot exceed ${MAX_ROUTINE_DURATION_MS} milliseconds.`;
        return;
      }

      cueHeadsUpLeadTimeMs = parsedCueHeadsUpLeadTime.value;
    }

    normalizedCues.push({
      id: cue.id,
      offsetMs: normalizedCueOffset.value,
      actionType: cue.actionType,
      ttsText: cue.ttsText,
      soundId: cue.soundId,
      headsUpOverride: cue.headsUpOverride,
      headsUpLeadTimeMs: cueHeadsUpLeadTimeMs,
    });
  });

  const validationResult = validateRoutine({
    routineDurationMs,
    cues: normalizedCues.map((cue) => ({
      id: cue.id,
      offsetMs: cue.offsetMs,
    })),
  });

  validationResult.issues.forEach((issue) => {
    if (issue.path === 'routineDurationMs') {
      if (!durationErrorText) {
        routineMessages.push(formatIssueFromValidation(issue));
      }
      return;
    }

    const cueIndex = parseCueOffsetPath(issue.path);
    if (cueIndex !== null) {
      const cueId = normalizedCues[cueIndex]?.id;
      if (!cueId || cueTimeErrorById[cueId]) {
        return;
      }

      if (issue.severity === 'error') {
        cueTimeErrorById[cueId] = issue.message;
        return;
      }

      if (!cueTimeWarningById[cueId]) {
        cueTimeWarningById[cueId] = issue.message;
      }
      return;
    }

    routineMessages.push(formatIssueFromValidation(issue));
  });

  const hasErrors =
    Boolean(durationErrorText) ||
    Boolean(startDelayErrorText) ||
    Boolean(headsUpLeadTimeErrorText) ||
    Object.keys(cueTimeErrorById).length > 0 ||
    Object.keys(cueHeadsUpLeadTimeErrorById).length > 0 ||
    routineMessages.some((issue) => issue.severity === 'error');
  const hasWarnings =
    Object.keys(cueTimeWarningById).length > 0 ||
    routineMessages.some((issue) => issue.severity === 'warning');

  return {
    routineDurationMs,
    startDelayMs,
    headsUpLeadTimeMs,
    normalizedCues,
    issues: {
      durationErrorText,
      startDelayErrorText,
      headsUpLeadTimeErrorText,
      cueTimeErrorById,
      cueHeadsUpLeadTimeErrorById,
      cueTimeWarningById,
      routineMessages,
      hasErrors,
      hasWarnings,
    },
  };
}

export function buildRoutineSavePayload(
  params: BuildRoutineSavePayloadParams
): BuildRoutineSavePayloadResult {
  const resolvedRoutineId =
    params.mode === 'update'
      ? params.routineId
      : params.routineId ?? params.idFactory?.() ?? createGeneratedRoutineId();

  if (!resolvedRoutineId) {
    throw new Error('routineId is required for update mode.');
  }

  const routine: Routine = {
    id: resolvedRoutineId,
    name: params.routineName.trim(),
    tags: parseTagsText(params.tagsText),
    favorite: params.favorite,
    routineDurationMs: params.routineDurationMs,
    startDelayMs: params.startDelayMs,
    headsUpEnabled: params.headsUpEnabled,
    headsUpLeadTimeMs: params.headsUpLeadTimeMs,
    hapticsEnabled: params.hapticsEnabled,
    duckPlannedFlag: params.duckPlannedFlag,
    cues: params.normalizedCues.map(cueToPersistedCue),
  };

  return {
    operation: params.mode,
    routine,
  };
}
