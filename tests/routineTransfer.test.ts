/// <reference types="jest" />

import type { Routine } from '../src/types';
import { RoutineTransferError } from '../src/services/routineTransferErrors';
import {
  createRoutineExportPayload,
  parseRoutineImportPayload,
} from '../src/services/routineTransfer';

function createRoutineFixture(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'routine-1',
    name: 'Morning',
    tags: ['warmup'],
    favorite: false,
    routineDurationMs: 60_000,
    defaultHeadsUpEnabled: true,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [
      {
        id: 'cue-1',
        offsetMs: 5_000,
        inputMode: 'elapsed',
        actionType: 'tts',
        ttsText: 'start',
        headsUpOverride: 'inherit',
      },
    ],
    ...overrides,
  };
}

function expectTransferErrorCode(error: unknown, expectedCode: RoutineTransferError['code']): void {
  expect(error).toBeInstanceOf(RoutineTransferError);
  if (error instanceof RoutineTransferError) {
    expect(error.code).toBe(expectedCode);
  }
}

describe('routine transfer parsing', () => {
  it('allows warning-only imports', () => {
    const routineWithWarnings = createRoutineFixture({
      cues: [
        {
          id: 'cue-1',
          offsetMs: 1_000,
          inputMode: 'elapsed',
          actionType: 'tts',
          ttsText: 'first',
          headsUpOverride: 'inherit',
        },
        {
          id: 'cue-2',
          offsetMs: 2_500,
          inputMode: 'elapsed',
          actionType: 'tts',
          ttsText: 'second',
          headsUpOverride: 'inherit',
        },
      ],
    });

    const exportPayload = createRoutineExportPayload(routineWithWarnings);
    const parsed = parseRoutineImportPayload(exportPayload);

    expect(parsed.routine).toEqual(routineWithWarnings);
    expect(parsed.warnings.some((warning) => warning.code === 'OVERLAPPING_CUES')).toBe(true);
  });

  it('blocks imports when routine validation has errors', () => {
    const routineWithErrors = createRoutineFixture({
      cues: [
        {
          id: 'cue-1',
          offsetMs: 1_000,
          inputMode: 'elapsed',
          actionType: 'tts',
          ttsText: 'first',
          headsUpOverride: 'inherit',
        },
        {
          id: 'cue-2',
          offsetMs: 1_000,
          inputMode: 'elapsed',
          actionType: 'tts',
          ttsText: 'duplicate timestamp',
          headsUpOverride: 'inherit',
        },
      ],
    });

    try {
      parseRoutineImportPayload(createRoutineExportPayload(routineWithErrors));
      throw new Error('Expected ROUTINE_VALIDATION_FAILED error.');
    } catch (error) {
      expectTransferErrorCode(error, 'ROUTINE_VALIDATION_FAILED');
    }
  });
});
