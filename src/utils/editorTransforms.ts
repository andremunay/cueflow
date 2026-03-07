import type {
  Cue,
  CueActionType,
  CueInputMode,
  HeadsUpOverride,
  Routine,
  SoundId,
  ValidationIssue,
} from '../types';
import { formatCueTimeFromMs, parseAndNormalizeCueOffsetMs, parseCueTimeToMs } from './time';
import { validateRoutine } from './validation';

export interface EditorCueDraftInput {
  id: string;
  timeText: string;
  inputMode: CueInputMode;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
}

export interface NormalizedEditorCue {
  id: string;
  offsetMs: number;
  inputMode: CueInputMode;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
}

export interface EditorIssueMessage {
  severity: 'error' | 'warning';
  message: string;
}

export interface EditorIssueBuckets {
  durationErrorText?: string;
  cueTimeErrorById: Record<string, string>;
  cueTimeWarningById: Record<string, string>;
  routineMessages: EditorIssueMessage[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface EvaluateEditorDraftParams {
  routineDurationText: string;
  cues: EditorCueDraftInput[];
}

export interface EvaluateEditorDraftResult {
  routineDurationMs: number | null;
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
  defaultHeadsUpEnabled: boolean;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  normalizedCues: NormalizedEditorCue[];
  idFactory?: () => string;
}

export interface BuildRoutineSavePayloadResult {
  operation: 'create' | 'update';
  routine: Routine;
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
    inputMode: cue.inputMode,
    actionType: cue.actionType,
    headsUpOverride: cue.headsUpOverride,
  };

  if (cue.actionType === 'tts' || cue.actionType === 'combo') {
    persistedCue.ttsText = cue.ttsText;
  }

  if (cue.actionType === 'sound' || cue.actionType === 'combo') {
    persistedCue.soundId = cue.soundId;
  }

  return persistedCue;
}

function formatIssueFromValidation(issue: ValidationIssue): EditorIssueMessage {
  return {
    severity: issue.severity,
    message: issue.message,
  };
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
  offsetMs: number,
  inputMode: CueInputMode,
  routineDurationMs: number
): string {
  const inputMs = inputMode === 'countdown' ? routineDurationMs - offsetMs : offsetMs;
  const safeInputMs = inputMs < 0 ? 0 : inputMs;
  const formatted = formatCueTimeFromMs(safeInputMs);
  return formatted.ok ? formatted.value : DEFAULT_TIME_TEXT;
}

export function evaluateEditorDraft(params: EvaluateEditorDraftParams): EvaluateEditorDraftResult {
  const cueTimeErrorById: Record<string, string> = {};
  const cueTimeWarningById: Record<string, string> = {};
  const routineMessages: EditorIssueMessage[] = [];
  const normalizedCues: NormalizedEditorCue[] = [];

  const parsedDuration = parseCueTimeToMs(params.routineDurationText);
  const routineDurationMs = parsedDuration.ok ? parsedDuration.value : null;
  const durationErrorText = parsedDuration.ok ? undefined : parsedDuration.error.message;

  params.cues.forEach((cue) => {
    const normalizedCueOffset = parseAndNormalizeCueOffsetMs({
      input: cue.timeText,
      inputMode: cue.inputMode,
      routineDurationMs: routineDurationMs ?? undefined,
    });

    if (!normalizedCueOffset.ok) {
      cueTimeErrorById[cue.id] = normalizedCueOffset.error.message;
      return;
    }

    normalizedCues.push({
      id: cue.id,
      offsetMs: normalizedCueOffset.value,
      inputMode: cue.inputMode,
      actionType: cue.actionType,
      ttsText: cue.ttsText,
      soundId: cue.soundId,
      headsUpOverride: cue.headsUpOverride,
    });
  });

  const validationResult = validateRoutine({
    routineDurationMs,
    cues: normalizedCues.map((cue) => ({
      id: cue.id,
      offsetMs: cue.offsetMs,
      inputMode: cue.inputMode,
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
    Object.keys(cueTimeErrorById).length > 0 ||
    routineMessages.some((issue) => issue.severity === 'error');
  const hasWarnings =
    Object.keys(cueTimeWarningById).length > 0 ||
    routineMessages.some((issue) => issue.severity === 'warning');

  return {
    routineDurationMs,
    normalizedCues,
    issues: {
      durationErrorText,
      cueTimeErrorById,
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
    defaultHeadsUpEnabled: params.defaultHeadsUpEnabled,
    hapticsEnabled: params.hapticsEnabled,
    duckPlannedFlag: params.duckPlannedFlag,
    cues: params.normalizedCues.map(cueToPersistedCue),
  };

  return {
    operation: params.mode,
    routine,
  };
}
