/// <reference types="jest" />

import {
  buildRoutineSavePayload,
  evaluateEditorDraft,
  parseTagsText,
  type NormalizedEditorCue,
} from '../src/utils';

interface CueDraftFixture {
  id: string;
  timeText: string;
  inputMode?: 'elapsed' | 'countdown';
}

function createCueDraftFixture({
  id,
  timeText,
  inputMode = 'elapsed',
}: CueDraftFixture) {
  return {
    id,
    timeText,
    inputMode,
    actionType: 'tts' as const,
    ttsText: `Cue ${id}`,
    soundId: 'beep' as const,
    headsUpOverride: 'inherit' as const,
  };
}

function toMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

describe('evaluateEditorDraft', () => {
  it('normalizes elapsed and countdown cue inputs into elapsed offsets', () => {
    const result = evaluateEditorDraft({
      routineDurationText: '02:00',
      cues: [
        createCueDraftFixture({ id: 'a', timeText: '00:30', inputMode: 'elapsed' }),
        createCueDraftFixture({ id: 'b', timeText: '00:30', inputMode: 'countdown' }),
      ],
    });

    expect(result.routineDurationMs).toBe(120_000);
    expect(result.normalizedCues.map((cue) => ({ id: cue.id, offsetMs: cue.offsetMs }))).toEqual([
      { id: 'a', offsetMs: 30_000 },
      { id: 'b', offsetMs: 90_000 },
    ]);
    expect(result.issues.hasErrors).toBe(false);
    expect(result.issues.hasWarnings).toBe(false);
  });

  it('buckets row warnings and routine-level issues separately', () => {
    const outOfOrderResult = evaluateEditorDraft({
      routineDurationText: '01:00',
      cues: [
        createCueDraftFixture({ id: 'first', timeText: '00:10' }),
        createCueDraftFixture({ id: 'second', timeText: '00:05' }),
      ],
    });

    expect(outOfOrderResult.issues.cueTimeWarningById.second).toContain('appears earlier');
    expect(outOfOrderResult.issues.routineMessages).toEqual([]);

    const tooManyCuesResult = evaluateEditorDraft({
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
      inputMode: 'elapsed',
      actionType: 'tts',
      ttsText: 'Speak',
      soundId: 'beep',
      headsUpOverride: 'inherit',
    },
    {
      id: 'cue-sound',
      offsetMs: 10_000,
      inputMode: 'elapsed',
      actionType: 'sound',
      ttsText: 'Ignored',
      soundId: 'chime',
      headsUpOverride: 'off',
    },
    {
      id: 'cue-combo',
      offsetMs: 15_000,
      inputMode: 'countdown',
      actionType: 'combo',
      ttsText: 'Both',
      soundId: 'whistle',
      headsUpOverride: 'on',
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
      defaultHeadsUpEnabled: true,
      hapticsEnabled: false,
      duckPlannedFlag: true,
      normalizedCues,
    });

    expect(result.operation).toBe('create');
    expect(result.routine.id).toBe('new-routine-id');
    expect(result.routine.name).toBe('Practice Set');
    expect(result.routine.tags).toEqual(['Tag One', 'tag two']);
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
      defaultHeadsUpEnabled: false,
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
        defaultHeadsUpEnabled: false,
        hapticsEnabled: false,
        duckPlannedFlag: false,
        normalizedCues: normalizedCues.slice(0, 1),
      })
    ).toThrow('routineId is required for update mode.');
  });
});
