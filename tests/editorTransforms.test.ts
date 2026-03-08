/// <reference types="jest" />

import {
  autoOrderCueDraftsByNormalizedElapsed,
  buildRoutineSavePayload,
  evaluateEditorDraft,
  parseTagsText,
  type NormalizedEditorCue,
} from '../src/utils';

interface CueDraftFixture {
  id: string;
  timeText: string;
  headsUpOverride?: 'inherit' | 'off' | 'on';
  headsUpLeadTimeText?: string;
}

function createCueDraftFixture({ id, timeText, headsUpOverride, headsUpLeadTimeText }: CueDraftFixture) {
  return {
    id,
    timeText,
    actionType: 'tts' as const,
    ttsText: `Cue ${id}`,
    soundId: 'beep' as const,
    headsUpOverride: headsUpOverride ?? ('inherit' as const),
    headsUpLeadTimeText: headsUpLeadTimeText ?? '',
  };
}

function toMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function evaluate(params: {
  routineDurationText: string;
  startDelayText?: string;
  headsUpEnabled?: boolean;
  headsUpLeadTimeText?: string;
  cues: ReturnType<typeof createCueDraftFixture>[];
}) {
  return evaluateEditorDraft({
    routineDurationText: params.routineDurationText,
    startDelayText: params.startDelayText ?? '00:03',
    headsUpEnabled: params.headsUpEnabled ?? true,
    headsUpLeadTimeText: params.headsUpLeadTimeText ?? '00:01',
    cues: params.cues,
  });
}

describe('evaluateEditorDraft', () => {
  it('normalizes elapsed cue inputs into offsets', () => {
    const result = evaluate({
      routineDurationText: '02:00',
      cues: [
        createCueDraftFixture({ id: 'a', timeText: '00:30' }),
        createCueDraftFixture({ id: 'b', timeText: '01:30' }),
      ],
    });

    expect(result.routineDurationMs).toBe(120_000);
    expect(result.startDelayMs).toBe(3_000);
    expect(result.headsUpLeadTimeMs).toBe(1_000);
    expect(result.normalizedCues.map((cue) => ({ id: cue.id, offsetMs: cue.offsetMs }))).toEqual([
      { id: 'a', offsetMs: 30_000 },
      { id: 'b', offsetMs: 90_000 },
    ]);
    expect(result.issues.hasErrors).toBe(false);
    expect(result.issues.hasWarnings).toBe(false);
  });

  it('buckets row warnings and routine-level issues separately', () => {
    const outOfOrderResult = evaluate({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'first', timeText: '00:10' }),
        createCueDraftFixture({ id: 'second', timeText: '00:05' }),
      ],
    });

    expect(outOfOrderResult.issues.cueTimeWarningById.second).toContain('appears earlier');
    expect(outOfOrderResult.issues.routineMessages).toEqual([]);

    const tooManyCuesResult = evaluate({
      routineDurationText: '10:00',
      cues: Array.from({ length: 201 }, (_, index) =>
        createCueDraftFixture({ id: `cue-${index}`, timeText: toMmSs(index) })
      ),
    });

    expect(
      tooManyCuesResult.issues.routineMessages.some((message) =>
        message.message.includes('more than 200 cues')
      )
    ).toBe(true);
    expect(tooManyCuesResult.issues.hasErrors).toBe(true);
  });

  it('flags invalid start delay input as a blocking error', () => {
    const result = evaluate({
      routineDurationText: '01:00',
      startDelayText: 'bad',
      cues: [createCueDraftFixture({ id: 'cue-1', timeText: '00:10' })],
    });

    expect(result.startDelayMs).toBeNull();
    expect(result.issues.startDelayErrorText).toContain('Time');
    expect(result.issues.hasErrors).toBe(true);
  });

  it('flags invalid heads-up lead time only when heads-up is enabled', () => {
    const enabledResult = evaluate({
      routineDurationText: '01:00',
      headsUpEnabled: true,
      headsUpLeadTimeText: 'bad',
      cues: [createCueDraftFixture({ id: 'cue-1', timeText: '00:10' })],
    });
    const disabledResult = evaluate({
      routineDurationText: '01:00',
      headsUpEnabled: false,
      headsUpLeadTimeText: 'bad',
      cues: [createCueDraftFixture({ id: 'cue-1', timeText: '00:10' })],
    });

    expect(enabledResult.headsUpLeadTimeMs).toBeNull();
    expect(enabledResult.issues.headsUpLeadTimeErrorText).toContain('Time');
    expect(enabledResult.issues.hasErrors).toBe(true);
    expect(disabledResult.headsUpLeadTimeMs).toBe(1_000);
    expect(disabledResult.issues.headsUpLeadTimeErrorText).toBeUndefined();
  });

  it('requires valid cue heads-up lead time when cue override is on', () => {
    const invalidResult = evaluate({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({
          id: 'cue-1',
          timeText: '00:10',
          headsUpOverride: 'on',
          headsUpLeadTimeText: 'bad',
        }),
      ],
    });

    expect(invalidResult.issues.cueHeadsUpLeadTimeErrorById['cue-1']).toContain('Time');
    expect(invalidResult.issues.hasErrors).toBe(true);
    expect(invalidResult.normalizedCues).toEqual([]);

    const validResult = evaluate({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({
          id: 'cue-1',
          timeText: '00:10',
          headsUpOverride: 'on',
          headsUpLeadTimeText: '00:02',
        }),
      ],
    });

    expect(validResult.issues.cueHeadsUpLeadTimeErrorById['cue-1']).toBeUndefined();
    expect(validResult.issues.hasErrors).toBe(false);
    expect(validResult.normalizedCues[0].headsUpLeadTimeMs).toBe(2_000);
  });

  it('treats blank cue-time rows as invalid input instead of duplicate timestamps', () => {
    const result = evaluate({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'existing-zero', timeText: '00:00' }),
        createCueDraftFixture({ id: 'new-empty', timeText: '' }),
      ],
    });

    expect(result.issues.cueTimeErrorById['new-empty']).toContain('cannot be empty');
    expect(
      Object.values(result.issues.cueTimeErrorById).some((message) =>
        message.toLowerCase().includes('duplicate')
      )
    ).toBe(false);
  });
});

describe('autoOrderCueDraftsByNormalizedElapsed', () => {
  it('orders valid cues in ascending normalized elapsed time', () => {
    const ordered = autoOrderCueDraftsByNormalizedElapsed({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'late', timeText: '00:45' }),
        createCueDraftFixture({ id: 'early', timeText: '00:05' }),
        createCueDraftFixture({ id: 'mid', timeText: '00:20' }),
      ],
    });

    expect(ordered.map((cue) => cue.id)).toEqual(['early', 'mid', 'late']);
  });

  it('keeps tie ordering stable when normalized offsets are equal', () => {
    const ordered = autoOrderCueDraftsByNormalizedElapsed({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'same-a', timeText: '00:10' }),
        createCueDraftFixture({ id: 'same-b', timeText: '00:10' }),
        createCueDraftFixture({ id: 'before', timeText: '00:05' }),
      ],
    });

    expect(ordered.map((cue) => cue.id)).toEqual(['before', 'same-a', 'same-b']);
  });

  it('keeps invalid cue rows anchored while sorting valid rows around them', () => {
    const ordered = autoOrderCueDraftsByNormalizedElapsed({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'late', timeText: '00:45' }),
        createCueDraftFixture({ id: 'invalid', timeText: 'bad' }),
        createCueDraftFixture({ id: 'early', timeText: '00:05' }),
        createCueDraftFixture({ id: 'mid', timeText: '00:20' }),
      ],
    });

    expect(ordered.map((cue) => cue.id)).toEqual(['early', 'invalid', 'mid', 'late']);
  });

  it('keeps appended blank-time cue rows at the bottom until valid time is entered', () => {
    const ordered = autoOrderCueDraftsByNormalizedElapsed({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'first', timeText: '00:00' }),
        createCueDraftFixture({ id: 'second', timeText: '00:30' }),
        createCueDraftFixture({ id: 'added', timeText: '' }),
      ],
    });

    expect(ordered.map((cue) => cue.id)).toEqual(['first', 'second', 'added']);
  });
});

describe('parseTagsText', () => {
  it('trims, drops empties, and de-duplicates tags case-insensitively', () => {
    expect(parseTagsText(' Warmup, focus, warmup,FOCUS , cooldown , ')).toEqual([
      'Warmup',
      'focus',
      'cooldown',
    ]);
  });
});

describe('buildRoutineSavePayload', () => {
  const normalizedCues: NormalizedEditorCue[] = [
    {
      id: 'cue-tts',
      offsetMs: 5_000,
      actionType: 'tts',
      ttsText: 'Speak',
      soundId: 'beep',
      headsUpOverride: 'inherit',
    },
    {
      id: 'cue-sound',
      offsetMs: 10_000,
      actionType: 'sound',
      ttsText: 'Ignored',
      soundId: 'chime',
      headsUpOverride: 'off',
    },
    {
      id: 'cue-combo',
      offsetMs: 15_000,
      actionType: 'combo',
      ttsText: 'Both',
      soundId: 'whistle',
      headsUpOverride: 'on',
      headsUpLeadTimeMs: 2_000,
    },
  ];

  it('creates payloads with generated ids in create mode and trims/normalizes fields', () => {
    const result = buildRoutineSavePayload({
      mode: 'create',
      idFactory: () => 'new-routine-id',
      routineName: '  Practice Set  ',
      tagsText: 'Tag One, tag two, TAG ONE',
      favorite: true,
      routineDurationMs: 60_000,
      startDelayMs: 3_000,
      headsUpEnabled: true,
      headsUpLeadTimeMs: 1_000,
      hapticsEnabled: false,
      duckPlannedFlag: true,
      normalizedCues,
    });

    expect(result.operation).toBe('create');
    expect(result.routine.id).toBe('new-routine-id');
    expect(result.routine.name).toBe('Practice Set');
    expect(result.routine.tags).toEqual(['Tag One', 'tag two']);
    expect(result.routine.startDelayMs).toBe(3_000);
    expect(result.routine.headsUpEnabled).toBe(true);
    expect(result.routine.headsUpLeadTimeMs).toBe(1_000);
    expect(result.routine.cues[0]).toMatchObject({
      actionType: 'tts',
      ttsText: 'Speak',
    });
    expect(result.routine.cues[0].soundId).toBeUndefined();
    expect(result.routine.cues[1]).toMatchObject({
      actionType: 'sound',
      soundId: 'chime',
    });
    expect(result.routine.cues[1].ttsText).toBeUndefined();
    expect(result.routine.cues[2]).toMatchObject({
      actionType: 'combo',
      ttsText: 'Both',
      soundId: 'whistle',
      headsUpLeadTimeMs: 2_000,
    });
  });

  it('uses the existing id in update mode and requires routineId', () => {
    const updated = buildRoutineSavePayload({
      mode: 'update',
      routineId: 'existing-routine-id',
      routineName: 'Edit',
      tagsText: 'one',
      favorite: false,
      routineDurationMs: 30_000,
      startDelayMs: 0,
      headsUpEnabled: false,
      headsUpLeadTimeMs: 1_000,
      hapticsEnabled: false,
      duckPlannedFlag: false,
      normalizedCues: normalizedCues.slice(0, 1),
    });

    expect(updated.operation).toBe('update');
    expect(updated.routine.id).toBe('existing-routine-id');

    expect(() =>
      buildRoutineSavePayload({
        mode: 'update',
        routineName: 'Missing ID',
        tagsText: '',
        favorite: false,
        routineDurationMs: 30_000,
        startDelayMs: 0,
        headsUpEnabled: false,
        headsUpLeadTimeMs: 1_000,
        hapticsEnabled: false,
        duckPlannedFlag: false,
        normalizedCues: normalizedCues.slice(0, 1),
      })
    ).toThrow('routineId is required for update mode.');
  });
});
