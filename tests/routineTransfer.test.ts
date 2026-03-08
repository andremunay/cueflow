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
    startDelayMs: 3_000,
    headsUpEnabled: true,
    headsUpLeadTimeMs: 1_000,
    hapticsEnabled: false,
    duckPlannedFlag: false,
    cues: [
      {
        id: 'cue-1',
        offsetMs: 5_000,
        actionType: 'tts',
        ttsText: 'start',
        headsUpOverride: 'on',
        headsUpLeadTimeMs: 2_000,
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
          actionType: 'tts',
          ttsText: 'first',
          headsUpOverride: 'inherit',
        },
        {
          id: 'cue-2',
          offsetMs: 2_500,
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
          actionType: 'tts',
          ttsText: 'first',
          headsUpOverride: 'inherit',
        },
        {
          id: 'cue-2',
          offsetMs: 1_000,
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

  it('blocks imports when elapsed cue offsets exceed routine duration', () => {
    const routineWithOutOfBoundsElapsedCue = createRoutineFixture({
      routineDurationMs: 10_000,
      cues: [
        {
          id: 'cue-1',
          offsetMs: 12_000,
          actionType: 'tts',
          ttsText: 'too late',
          headsUpOverride: 'inherit',
        },
      ],
    });

    try {
      parseRoutineImportPayload(createRoutineExportPayload(routineWithOutOfBoundsElapsedCue));
      throw new Error('Expected ROUTINE_VALIDATION_FAILED error.');
    } catch (error) {
      expectTransferErrorCode(error, 'ROUTINE_VALIDATION_FAILED');
    }
  });

  it('rejects imports that include legacy inputMode fields', () => {
    const payload = JSON.stringify({
      version: 1,
      routine: {
        ...createRoutineFixture(),
        cues: [
          {
            id: 'cue-legacy',
            offsetMs: 1_000,
            inputMode: 'countdown',
            actionType: 'tts',
            ttsText: 'legacy',
            headsUpOverride: 'inherit',
          },
        ],
      },
    });

    try {
      parseRoutineImportPayload(payload);
      throw new Error('Expected INVALID_ROUTINE_CONTENT error.');
    } catch (error) {
      expectTransferErrorCode(error, 'INVALID_ROUTINE_CONTENT');
    }
  });
});
