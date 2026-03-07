/// <reference types="jest" />

import { createPlaybackController } from '../src/services/playbackController';
import type { Cue, Routine } from '../src/types';

interface MockMedia {
  playSound: jest.Mock<Promise<void>, [soundId: 'beep' | 'chime' | 'whistle']>;
  speakText: jest.Mock<Promise<void>, [text: string]>;
  triggerHaptic: jest.Mock<Promise<void>, []>;
}

interface TestClock {
  value: number;
}

function createCue(overrides: Partial<Cue> & Pick<Cue, 'id' | 'offsetMs' | 'actionType'>): Cue {
  const base: Cue = {
    id: overrides.id,
    offsetMs: overrides.offsetMs,
    inputMode: 'elapsed',
    actionType: overrides.actionType,
    headsUpOverride: 'inherit',
  };

  if (overrides.actionType === 'tts') {
    base.ttsText = overrides.ttsText ?? `Cue ${overrides.id}`;
  }

  if (overrides.actionType === 'sound' || overrides.actionType === 'combo') {
    base.soundId = overrides.soundId ?? 'beep';
  }

  if (overrides.actionType === 'combo') {
    base.ttsText = overrides.ttsText ?? `Cue ${overrides.id}`;
  }

  return {
    ...base,
    ...overrides,
  };
}

function createRoutine(params: {
  cues: Cue[];
  routineDurationMs: number;
  hapticsEnabled?: boolean;
}): Routine {
  return {
    id: 'routine-1',
    name: 'Test Routine',
    tags: [],
    favorite: false,
    routineDurationMs: params.routineDurationMs,
    defaultHeadsUpEnabled: true,
    hapticsEnabled: params.hapticsEnabled ?? false,
    duckPlannedFlag: false,
    cues: params.cues,
  };
}

function createMockMedia(): MockMedia {
  return {
    playSound: jest.fn<Promise<void>, [soundId: 'beep' | 'chime' | 'whistle']>(
      async () => undefined
    ),
    speakText: jest.fn<Promise<void>, [text: string]>(async () => undefined),
    triggerHaptic: jest.fn<Promise<void>, []>(async () => undefined),
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

async function advanceTime(clock: TestClock, ms: number): Promise<void> {
  clock.value += ms;
  jest.advanceTimersByTime(ms);
  await flushMicrotasks();
}

describe('createPlaybackController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('fires due events once across interval ticks', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 8_000,
      cues: [createCue({ id: 'cue-1', offsetMs: 5_000, actionType: 'tts', ttsText: 'Move' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();

    await advanceTime(clock, 2_000);
    expect(media.playSound).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenNthCalledWith(1, 'beep');

    await advanceTime(clock, 3_000);
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenNthCalledWith(1, 'Move');

    await advanceTime(clock, 2_000);
    expect(media.playSound).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenCalledTimes(1);
  });

  it('pauses progression and resumes with paused-duration shifting', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 9_000,
      cues: [createCue({ id: 'cue-1', offsetMs: 5_000, actionType: 'tts', ttsText: 'Resume cue' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    await advanceTime(clock, 3_000);

    controller.pause();
    const pausedState = controller.getState();
    expect(pausedState.status).toBe('paused');
    expect(pausedState.elapsedMs).toBe(3_000);

    await advanceTime(clock, 4_000);
    expect(controller.getState().elapsedMs).toBe(3_000);
    expect(media.speakText).toHaveBeenCalledTimes(0);

    controller.resume();
    await flushMicrotasks();
    expect(controller.getState().totalPausedMs).toBe(4_000);

    await advanceTime(clock, 1_000);
    expect(media.speakText).toHaveBeenCalledTimes(0);

    await advanceTime(clock, 1_000);
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenNthCalledWith(1, 'Resume cue');
  });

  it('skips to the next cue immediately and advances timeline without duplicate firing', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 15_000,
      cues: [
        createCue({ id: 'cue-1', offsetMs: 8_000, actionType: 'tts', ttsText: 'First' }),
        createCue({ id: 'cue-2', offsetMs: 12_000, actionType: 'tts', ttsText: 'Second' }),
      ],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    await advanceTime(clock, 1_000);

    controller.skipToNextCue();
    await flushMicrotasks();

    const stateAfterSkip = controller.getState();
    expect(stateAfterSkip.elapsedMs).toBe(8_000);
    expect(stateAfterSkip.lastExecutedCueId).toBe('cue-1');
    expect(stateAfterSkip.firedCueIds).toEqual(['cue-1']);
    expect(stateAfterSkip.firedHeadsUpCueIds).toContain('cue-1');
    expect(stateAfterSkip.nextCueIndex).toBe(1);
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenNthCalledWith(1, 'First');
    expect(media.playSound).toHaveBeenCalledTimes(0);

    await advanceTime(clock, 1_500);
    expect(media.playSound).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenNthCalledWith(1, 'beep');
    expect(media.speakText).toHaveBeenCalledTimes(1);

    await advanceTime(clock, 2_500);
    expect(media.speakText).toHaveBeenCalledTimes(2);
    expect(media.speakText).toHaveBeenNthCalledWith(2, 'Second');

    await advanceTime(clock, 2_000);
    expect(media.speakText).toHaveBeenCalledTimes(2);
  });

  it('uses beep-only heads-up without TTS or haptic at heads-up time', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 8_000,
      hapticsEnabled: true,
      cues: [createCue({ id: 'cue-1', offsetMs: 6_000, actionType: 'tts', ttsText: 'Cue now' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();

    await advanceTime(clock, 3_000);
    expect(media.playSound).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenNthCalledWith(1, 'beep');
    expect(media.speakText).toHaveBeenCalledTimes(0);
    expect(media.triggerHaptic).toHaveBeenCalledTimes(0);

    await advanceTime(clock, 3_000);
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.triggerHaptic).toHaveBeenCalledTimes(1);
  });

  it('maps cue action types to the expected media calls', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 3_000,
      cues: [
        createCue({ id: 'cue-tts', offsetMs: 1_000, actionType: 'tts', ttsText: 'One' }),
        createCue({ id: 'cue-sound', offsetMs: 1_500, actionType: 'sound', soundId: 'chime' }),
        createCue({
          id: 'cue-combo',
          offsetMs: 2_500,
          actionType: 'combo',
          soundId: 'whistle',
          ttsText: 'Three',
        }),
      ],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    await advanceTime(clock, 3_000);

    expect(media.speakText).toHaveBeenCalledTimes(2);
    expect(media.speakText).toHaveBeenNthCalledWith(1, 'One');
    expect(media.speakText).toHaveBeenNthCalledWith(2, 'Three');
    expect(media.playSound).toHaveBeenCalledTimes(2);
    expect(media.playSound).toHaveBeenNthCalledWith(1, 'chime');
    expect(media.playSound).toHaveBeenNthCalledWith(2, 'whistle');
    expect(media.triggerHaptic).toHaveBeenCalledTimes(0);
  });

  it('replays the last executed cue without replaying heads-up or shifting playback state', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 9_000,
      cues: [createCue({ id: 'cue-1', offsetMs: 4_000, actionType: 'tts', ttsText: 'Repeat me' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    await advanceTime(clock, 4_000);

    const stateBeforeReplay = controller.getState();
    expect(stateBeforeReplay.lastExecutedCueId).toBe('cue-1');
    expect(media.playSound).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenCalledTimes(1);

    controller.replayLastCue();
    await flushMicrotasks();

    const stateAfterReplay = controller.getState();
    expect(stateAfterReplay.elapsedMs).toBe(stateBeforeReplay.elapsedMs);
    expect(stateAfterReplay.firedCueIds).toEqual(stateBeforeReplay.firedCueIds);
    expect(stateAfterReplay.firedHeadsUpCueIds).toEqual(stateBeforeReplay.firedHeadsUpCueIds);
    expect(stateAfterReplay.nextCueIndex).toBe(stateBeforeReplay.nextCueIndex);
    expect(media.speakText).toHaveBeenCalledTimes(2);
    expect(media.speakText).toHaveBeenNthCalledWith(2, 'Repeat me');
    expect(media.playSound).toHaveBeenCalledTimes(1);
  });

  it('treats skip and replay as no-ops when not running', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 1_500,
      cues: [createCue({ id: 'cue-1', offsetMs: 1_000, actionType: 'tts', ttsText: 'Only cue' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.skipToNextCue();
    controller.replayLastCue();
    expect(media.speakText).toHaveBeenCalledTimes(0);
    expect(media.playSound).toHaveBeenCalledTimes(0);

    controller.start();
    await flushMicrotasks();
    controller.pause();
    controller.skipToNextCue();
    controller.replayLastCue();
    expect(media.speakText).toHaveBeenCalledTimes(0);
    expect(media.playSound).toHaveBeenCalledTimes(0);

    controller.resume();
    await flushMicrotasks();
    await advanceTime(clock, 1_500);
    expect(controller.getState().status).toBe('completed');
    expect(media.speakText).toHaveBeenCalledTimes(1);

    controller.skipToNextCue();
    controller.replayLastCue();
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenCalledTimes(0);

    controller.stop();
    controller.skipToNextCue();
    controller.replayLastCue();
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenCalledTimes(0);
  });

  it('treats skip and replay as no-ops when target cues are missing while running', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 8_000,
      cues: [createCue({ id: 'cue-1', offsetMs: 5_000, actionType: 'tts', ttsText: 'Skippable' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    controller.replayLastCue();
    await flushMicrotasks();
    expect(media.speakText).toHaveBeenCalledTimes(0);

    controller.skipToNextCue();
    await flushMicrotasks();
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.speakText).toHaveBeenNthCalledWith(1, 'Skippable');

    controller.skipToNextCue();
    await flushMicrotasks();
    expect(media.speakText).toHaveBeenCalledTimes(1);
    expect(media.playSound).toHaveBeenCalledTimes(0);
  });

  it('resets execution state on stop and clears ticking on dispose', async () => {
    const media = createMockMedia();
    const clock: TestClock = { value: 0 };
    const routine = createRoutine({
      routineDurationMs: 10_000,
      cues: [createCue({ id: 'cue-1', offsetMs: 7_000, actionType: 'sound', soundId: 'chime' })],
    });

    const controller = createPlaybackController({
      routine,
      tickIntervalMs: 100,
      now: () => clock.value,
      media,
    });

    controller.start();
    await flushMicrotasks();
    await advanceTime(clock, 2_000);
    expect(media.playSound).toHaveBeenCalledTimes(0);

    controller.stop();
    const stopped = controller.getState();
    expect(stopped.status).toBe('stopped');
    expect(stopped.elapsedMs).toBe(0);
    expect(stopped.firedCueIds).toEqual([]);
    expect(stopped.firedHeadsUpCueIds).toEqual([]);
    expect(stopped.lastExecutedCueId).toBeNull();

    await advanceTime(clock, 8_000);
    expect(media.playSound).toHaveBeenCalledTimes(0);

    controller.start();
    await flushMicrotasks();
    controller.dispose();
    expect(controller.getState().status).toBe('stopped');

    await advanceTime(clock, 8_000);
    expect(media.playSound).toHaveBeenCalledTimes(0);
    expect(media.speakText).toHaveBeenCalledTimes(0);
  });
});
