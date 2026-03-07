import { MAX_CUE_COUNT, MAX_ROUTINE_DURATION_MS } from '../constants';
import type { CueInputMode, ValidationIssue, ValidationResult } from '../types';

export const OVERLAP_WARNING_GAP_MS = 3_000;

export interface RoutineValidationCueInput {
  id: string;
  offsetMs: number;
  inputMode: CueInputMode;
}

export interface RoutineValidationInput {
  routineDurationMs?: number | null;
  cues: RoutineValidationCueInput[];
}

interface IndexedCue {
  index: number;
  cue: RoutineValidationCueInput;
}

function isValidRequiredDuration(value: number | null | undefined): value is number {
  return Number.isFinite(value) && Number.isInteger(value) && (value ?? 0) > 0;
}

function createErrorIssue(
  code: ValidationIssue['code'],
  message: string,
  path?: string
): ValidationIssue {
  return { severity: 'error', code, message, path };
}

function createWarningIssue(
  code: ValidationIssue['code'],
  message: string,
  path?: string
): ValidationIssue {
  return { severity: 'warning', code, message, path };
}

function collectDurationIssues(
  issues: ValidationIssue[],
  routineDurationMs: number | null | undefined
): { hasValidDuration: boolean; durationMs: number | null } {
  if (!isValidRequiredDuration(routineDurationMs)) {
    issues.push(
      createErrorIssue(
        'MISSING_ROUTINE_DURATION',
        'Routine duration is required and must be a positive integer number of milliseconds.',
        'routineDurationMs'
      )
    );

    return { hasValidDuration: false, durationMs: null };
  }

  if (routineDurationMs > MAX_ROUTINE_DURATION_MS) {
    issues.push(
      createErrorIssue(
        'DURATION_EXCEEDS_MAX',
        `Routine duration cannot exceed ${MAX_ROUTINE_DURATION_MS} milliseconds.`,
        'routineDurationMs'
      )
    );
  }

  return { hasValidDuration: true, durationMs: routineDurationMs };
}

function collectCueCountIssue(issues: ValidationIssue[], cues: RoutineValidationCueInput[]): void {
  if (cues.length > MAX_CUE_COUNT) {
    issues.push(
      createErrorIssue(
        'CUE_COUNT_EXCEEDS_MAX',
        `Routine cannot have more than ${MAX_CUE_COUNT} cues.`,
        'cues'
      )
    );
  }
}

function collectNegativeTimeIssues(
  issues: ValidationIssue[],
  cues: RoutineValidationCueInput[]
): void {
  cues.forEach((cue, index) => {
    if (cue.offsetMs < 0) {
      issues.push(
        createErrorIssue(
          'NEGATIVE_TIME',
          'Cue time cannot be negative.',
          `cues[${index}].offsetMs`
        )
      );
    }
  });
}

function collectDuplicateTimestampIssues(
  issues: ValidationIssue[],
  cues: RoutineValidationCueInput[]
): void {
  const seenOffsets = new Set<number>();

  cues.forEach((cue, index) => {
    if (seenOffsets.has(cue.offsetMs)) {
      issues.push(
        createErrorIssue(
          'DUPLICATE_TIMESTAMP',
          `Cue timestamp ${cue.offsetMs}ms duplicates an earlier cue.`,
          `cues[${index}].offsetMs`
        )
      );
      return;
    }

    seenOffsets.add(cue.offsetMs);
  });
}

function collectCountdownConversionIssues(
  issues: ValidationIssue[],
  cues: RoutineValidationCueInput[],
  durationMs: number | null,
  hasValidDuration: boolean
): void {
  if (!hasValidDuration || durationMs === null) {
    return;
  }

  cues.forEach((cue, index) => {
    if (cue.inputMode !== 'countdown') {
      return;
    }

    if (cue.offsetMs < 0 || cue.offsetMs > durationMs) {
      issues.push(
        createErrorIssue(
          'INVALID_COUNTDOWN_CONVERSION',
          `Countdown cue offset must be within [0, ${durationMs}] milliseconds.`,
          `cues[${index}].offsetMs`
        )
      );
    }
  });
}

function collectOutOfOrderIssues(
  issues: ValidationIssue[],
  cues: RoutineValidationCueInput[]
): void {
  for (let index = 1; index < cues.length; index += 1) {
    const currentCue = cues[index];
    const previousCue = cues[index - 1];

    if (currentCue.offsetMs < previousCue.offsetMs) {
      issues.push(
        createWarningIssue(
          'OUT_OF_ORDER_CUES',
          'Cue appears earlier than the previous cue in list order.',
          `cues[${index}].offsetMs`
        )
      );
    }
  }
}

function collectOverlapIssues(issues: ValidationIssue[], cues: RoutineValidationCueInput[]): void {
  const indexedCues: IndexedCue[] = cues.map((cue, index) => ({ cue, index }));
  const sortedCues = indexedCues.sort((left, right) => {
    const byOffset = left.cue.offsetMs - right.cue.offsetMs;
    if (byOffset !== 0) {
      return byOffset;
    }

    return left.index - right.index;
  });

  for (let index = 1; index < sortedCues.length; index += 1) {
    const current = sortedCues[index];
    const previous = sortedCues[index - 1];
    const gapMs = current.cue.offsetMs - previous.cue.offsetMs;

    if (gapMs > 0 && gapMs < OVERLAP_WARNING_GAP_MS) {
      issues.push(
        createWarningIssue(
          'OVERLAPPING_CUES',
          `Cue occurs ${gapMs}ms after the prior cue, which is under the ${OVERLAP_WARNING_GAP_MS}ms overlap threshold.`,
          `cues[${current.index}].offsetMs`
        )
      );
    }
  }
}

export function validateRoutine(input: RoutineValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { hasValidDuration, durationMs } = collectDurationIssues(issues, input.routineDurationMs);

  collectCueCountIssue(issues, input.cues);
  collectNegativeTimeIssues(issues, input.cues);
  collectDuplicateTimestampIssues(issues, input.cues);
  collectCountdownConversionIssues(issues, input.cues, durationMs, hasValidDuration);
  collectOutOfOrderIssues(issues, input.cues);
  collectOverlapIssues(issues, input.cues);

  return {
    issues,
    hasErrors: issues.some((issue) => issue.severity === 'error'),
    hasWarnings: issues.some((issue) => issue.severity === 'warning'),
  };
}
