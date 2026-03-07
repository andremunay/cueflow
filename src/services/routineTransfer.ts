import type { Routine, ValidationIssue } from '../types';
import { validateRoutine } from '../utils';
import { RoutineStorageError } from './routineStorageErrors';
import { RoutineTransferError } from './routineTransferErrors';
import {
  createRoutineExportWrapper,
  deserializeRoutineExportWrapper,
  serializeRoutineExportWrapper,
} from './routineTransferSerialization';

export interface ParsedRoutineImportResult {
  routine: Routine;
  warnings: ValidationIssue[];
}

function buildValidationIssuesForImport(routine: Routine): ValidationIssue[] {
  const validationResult = validateRoutine({
    routineDurationMs: routine.routineDurationMs,
    cues: routine.cues.map((cue) => ({
      id: cue.id,
      offsetMs: cue.offsetMs,
      inputMode: cue.inputMode,
    })),
  });

  if (validationResult.hasErrors) {
    const errorMessages = validationResult.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message);

    const details = errorMessages.length > 0 ? ` ${errorMessages.join(' ')}` : '';
    throw new RoutineTransferError(
      'ROUTINE_VALIDATION_FAILED',
      `Import blocked because the routine contains validation errors.${details}`
    );
  }

  return validationResult.issues.filter((issue) => issue.severity === 'warning');
}

export function createRoutineExportPayload(routine: Routine): string {
  const wrapper = createRoutineExportWrapper(routine);
  return serializeRoutineExportWrapper(wrapper);
}

export function parseRoutineImportPayload(rawJson: string): ParsedRoutineImportResult {
  const wrapper = deserializeRoutineExportWrapper(rawJson);
  const warnings = buildValidationIssuesForImport(wrapper.routine);

  return {
    routine: wrapper.routine,
    warnings,
  };
}

export async function importRoutineFromJson(rawJson: string): Promise<ParsedRoutineImportResult> {
  const parsed = parseRoutineImportPayload(rawJson);
  const { createRoutine } = await import('./routineStorage');

  try {
    const savedRoutine = await createRoutine(parsed.routine);
    return {
      routine: savedRoutine,
      warnings: parsed.warnings,
    };
  } catch (error: unknown) {
    if (error instanceof RoutineStorageError && error.code === 'DUPLICATE_ROUTINE_ID') {
      throw new RoutineTransferError(
        'DUPLICATE_ROUTINE_ID',
        `Routine with id "${parsed.routine.id}" already exists.`
      );
    }

    throw error;
  }
}
