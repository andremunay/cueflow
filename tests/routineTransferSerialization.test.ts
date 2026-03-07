/// <reference types="jest" />

import type { Routine } from '../src/types';
import { RoutineTransferError } from '../src/services/routineTransferErrors';
import {
  createRoutineExportWrapper,
  deserializeRoutineExportWrapper,
  ROUTINE_EXPORT_VERSION,
  serializeRoutineExportWrapper,
} from '../src/services/routineTransferSerialization';

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

describe('routine transfer serialization', () => {
  it('round-trips a valid routine export wrapper', () => {
    const routine = createRoutineFixture();
    const wrapper = createRoutineExportWrapper(routine);

    const serialized = serializeRoutineExportWrapper(wrapper);
    const deserialized = deserializeRoutineExportWrapper(serialized);

    expect(deserialized).toEqual({
      version: ROUTINE_EXPORT_VERSION,
      routine,
    });
    expect(deserialized.routine).not.toBe(routine);
  });

  it('rejects invalid JSON payloads', () => {
    try {
      deserializeRoutineExportWrapper('{bad json');
      throw new Error('Expected INVALID_JSON error.');
    } catch (error) {
      expectTransferErrorCode(error, 'INVALID_JSON');
    }
  });

  it('rejects missing or invalid export version', () => {
    const payloadWithoutVersion = JSON.stringify({
      routine: createRoutineFixture(),
    });
    const payloadWithWrongVersion = JSON.stringify({
      version: 3,
      routine: createRoutineFixture(),
    });

    try {
      deserializeRoutineExportWrapper(payloadWithoutVersion);
      throw new Error('Expected UNSUPPORTED_EXPORT_VERSION error.');
    } catch (error) {
      expectTransferErrorCode(error, 'UNSUPPORTED_EXPORT_VERSION');
    }

    try {
      deserializeRoutineExportWrapper(payloadWithWrongVersion);
      throw new Error('Expected UNSUPPORTED_EXPORT_VERSION error.');
    } catch (error) {
      expectTransferErrorCode(error, 'UNSUPPORTED_EXPORT_VERSION');
    }
  });

  it('rejects missing routine field', () => {
    const payload = JSON.stringify({
      version: ROUTINE_EXPORT_VERSION,
    });

    try {
      deserializeRoutineExportWrapper(payload);
      throw new Error('Expected INVALID_EXPORT_STRUCTURE error.');
    } catch (error) {
      expectTransferErrorCode(error, 'INVALID_EXPORT_STRUCTURE');
    }
  });

  it('rejects invalid routine structure', () => {
    const payload = JSON.stringify({
      version: ROUTINE_EXPORT_VERSION,
      routine: {
        ...createRoutineFixture(),
        tags: 'not-an-array',
      },
    });

    try {
      deserializeRoutineExportWrapper(payload);
      throw new Error('Expected INVALID_ROUTINE_CONTENT error.');
    } catch (error) {
      expectTransferErrorCode(error, 'INVALID_ROUTINE_CONTENT');
    }
  });
});
