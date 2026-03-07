import { PLAYBACK_TICK_INTERVAL_TARGET_MS } from '../constants';
import type { Cue, PlaybackState, Routine, SoundId } from '../types';
import {
  buildOrderedPlaybackCues,
  collectDuePlaybackEvents,
  computePlaybackElapsedMs,
  findNextCueSortedIndex,
  type PlaybackDueEvent,
} from './playbackScheduler';

export type PlaybackStateListener = (state: PlaybackState) => void;

export interface PlaybackMediaActions {
  playSound: (soundId: SoundId) => Promise<void> | void;
  speakText: (text: string) => Promise<void> | void;
  triggerHaptic: () => Promise<void> | void;
}

export interface CreatePlaybackControllerOptions {
  routine: Routine;
  tickIntervalMs?: number;
  now?: () => number;
  media?: Partial<PlaybackMediaActions>;
}

export interface PlaybackController {
  getState: () => PlaybackState;
  subscribe: (listener: PlaybackStateListener) => () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipToNextCue: () => void;
  replayLastCue: () => void;
  dispose: () => void;
}

function clonePlaybackState(state: PlaybackState): PlaybackState {
  return {
    ...state,
    firedCueIds: [...state.firedCueIds],
    firedHeadsUpCueIds: [...state.firedHeadsUpCueIds],
  };
}

function createBaseState(routineId: string, nextCueIndex: number): PlaybackState {
  return {
    status: 'idle',
    routineId,
    routineStartTimeMs: null,
    pauseStartedAtMs: null,
    totalPausedMs: 0,
    elapsedMs: 0,
    nextCueIndex,
    lastExecutedCueId: null,
    firedCueIds: [],
    firedHeadsUpCueIds: [],
  };
}

async function safelyInvoke(action: () => Promise<void> | void): Promise<void> {
  try {
    await action();
  } catch {
    // Playback should continue even when device media APIs fail.
  }
}

function loadDefaultMediaActions(): PlaybackMediaActions {
  const mediaModule = require('./media') as typeof import('./media');
  return {
    playSound: mediaModule.playSound,
    speakText: mediaModule.speakText,
    triggerHaptic: mediaModule.triggerHaptic,
  };
}

export function createPlaybackController(options: CreatePlaybackControllerOptions): PlaybackController {
  const { routine } = options;
  const orderedCues = buildOrderedPlaybackCues(routine.cues);
  const cueById = new Map(orderedCues.map(({ cue }) => [cue.id, cue]));
  const defaultNextCueIndex = orderedCues.length > 0 ? 0 : -1;
  const listeners = new Set<PlaybackStateListener>();
  const now = options.now ?? (() => Date.now());
  const tickIntervalMs = options.tickIntervalMs ?? PLAYBACK_TICK_INTERVAL_TARGET_MS;
  let defaultMediaActions: PlaybackMediaActions | null = null;
  const getDefaultMediaActions = (): PlaybackMediaActions => {
    if (defaultMediaActions) {
      return defaultMediaActions;
    }

    defaultMediaActions = loadDefaultMediaActions();
    return defaultMediaActions;
  };
  const media: PlaybackMediaActions = {
    playSound:
      options.media?.playSound ??
      ((soundId) => {
        return getDefaultMediaActions().playSound(soundId);
      }),
    speakText:
      options.media?.speakText ??
      ((text) => {
        return getDefaultMediaActions().speakText(text);
      }),
    triggerHaptic:
      options.media?.triggerHaptic ??
      (() => {
        return getDefaultMediaActions().triggerHaptic();
      }),
  };

  let state: PlaybackState = createBaseState(routine.id, defaultNextCueIndex);
  let tickIntervalHandle: ReturnType<typeof setInterval> | null = null;
  let previousElapsedMs = -1;
  let tickInFlight = false;

  const emitState = (): void => {
    const snapshot = clonePlaybackState(state);
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const clearTickInterval = (): void => {
    if (!tickIntervalHandle) {
      return;
    }

    clearInterval(tickIntervalHandle);
    tickIntervalHandle = null;
  };

  const executeCueAction = async (cue: Cue): Promise<void> => {
    const cueText = cue.ttsText?.trim() ?? '';
    const cueSoundId = cue.soundId ?? 'beep';

    switch (cue.actionType) {
      case 'tts':
        if (cueText.length > 0) {
          await safelyInvoke(() => media.speakText(cueText));
        }
        break;
      case 'sound':
        await safelyInvoke(() => media.playSound(cueSoundId));
        break;
      case 'combo':
        await safelyInvoke(() => media.playSound(cueSoundId));
        if (cueText.length > 0) {
          await safelyInvoke(() => media.speakText(cueText));
        }
        break;
      default:
        break;
    }

    if (routine.hapticsEnabled) {
      await safelyInvoke(() => media.triggerHaptic());
    }
  };

  const executeCueEvent = async (event: PlaybackDueEvent): Promise<void> => {
    if (event.type === 'headsUp') {
      await safelyInvoke(() => media.playSound('beep'));
      return;
    }

    await executeCueAction(event.cue);
  };

  const tick = async (): Promise<void> => {
    if (tickInFlight) {
      return;
    }

    if (state.status !== 'running' || state.routineStartTimeMs === null) {
      return;
    }

    tickInFlight = true;

    try {
      const rawElapsedMs = computePlaybackElapsedMs({
        routineStartTimeMs: state.routineStartTimeMs,
        nowMs: now(),
        totalPausedMs: state.totalPausedMs,
      });
      const currentElapsedMs = Math.min(rawElapsedMs, routine.routineDurationMs);

      const dueResult = collectDuePlaybackEvents({
        orderedCues,
        previousElapsedMs,
        currentElapsedMs,
        fired: {
          firedCueIds: state.firedCueIds,
          firedHeadsUpCueIds: state.firedHeadsUpCueIds,
        },
      });

      previousElapsedMs = currentElapsedMs;

      if (state.status !== 'running') {
        return;
      }

      let lastExecutedCueId = state.lastExecutedCueId;
      dueResult.events.forEach((event) => {
        if (event.type === 'cue') {
          lastExecutedCueId = event.cueId;
        }
      });

      state = {
        ...state,
        elapsedMs: currentElapsedMs,
        firedCueIds: dueResult.firedCueIds,
        firedHeadsUpCueIds: dueResult.firedHeadsUpCueIds,
        lastExecutedCueId,
        nextCueIndex: findNextCueSortedIndex(orderedCues, dueResult.firedCueIds),
      };
      emitState();

      for (const event of dueResult.events) {
        if (state.status !== 'running') {
          break;
        }

        await executeCueEvent(event);
      }

      if (state.status !== 'running') {
        return;
      }

      if (currentElapsedMs >= routine.routineDurationMs) {
        clearTickInterval();
        state = {
          ...state,
          status: 'completed',
          pauseStartedAtMs: null,
          nextCueIndex: -1,
        };
        emitState();
      }
    } finally {
      tickInFlight = false;
    }
  };

  const startTicking = (): void => {
    clearTickInterval();
    tickIntervalHandle = setInterval(() => {
      void tick();
    }, tickIntervalMs);
  };

  const start = (): void => {
    const startTimeMs = now();
    state = {
      status: 'running',
      routineId: routine.id,
      routineStartTimeMs: startTimeMs,
      pauseStartedAtMs: null,
      totalPausedMs: 0,
      elapsedMs: 0,
      nextCueIndex: defaultNextCueIndex,
      lastExecutedCueId: null,
      firedCueIds: [],
      firedHeadsUpCueIds: [],
    };
    previousElapsedMs = -1;
    emitState();
    startTicking();
    void tick();
  };

  const pause = (): void => {
    if (state.status !== 'running') {
      return;
    }

    clearTickInterval();
    state = {
      ...state,
      status: 'paused',
      pauseStartedAtMs: now(),
    };
    emitState();
  };

  const resume = (): void => {
    if (state.status !== 'paused' || state.pauseStartedAtMs === null) {
      return;
    }

    const pausedDurationMs = Math.max(0, now() - state.pauseStartedAtMs);
    state = {
      ...state,
      status: 'running',
      pauseStartedAtMs: null,
      totalPausedMs: state.totalPausedMs + pausedDurationMs,
    };
    emitState();
    startTicking();
    void tick();
  };

  const stop = (): void => {
    clearTickInterval();
    state = {
      ...createBaseState(routine.id, defaultNextCueIndex),
      status: 'stopped',
    };
    previousElapsedMs = -1;
    emitState();
  };

  const skipToNextCue = (): void => {
    if (state.status !== 'running') {
      return;
    }

    const firedCueIdsSet = new Set(state.firedCueIds);
    const nextOrderedCue = orderedCues.find(({ cue }) => !firedCueIdsSet.has(cue.id));
    if (!nextOrderedCue) {
      return;
    }

    const nextCue = nextOrderedCue.cue;
    const firedCueIds = [...state.firedCueIds, nextCue.id];
    const firedHeadsUpCueIdsSet = new Set(state.firedHeadsUpCueIds);
    firedHeadsUpCueIdsSet.add(nextCue.id);

    const nowMs = now();
    const targetElapsedMs = Math.max(state.elapsedMs, nextCue.offsetMs);
    const routineStartTimeMs =
      state.routineStartTimeMs === null
        ? null
        : nowMs - targetElapsedMs - state.totalPausedMs;

    previousElapsedMs = targetElapsedMs;

    state = {
      ...state,
      routineStartTimeMs,
      elapsedMs: targetElapsedMs,
      firedCueIds,
      firedHeadsUpCueIds: Array.from(firedHeadsUpCueIdsSet),
      lastExecutedCueId: nextCue.id,
      nextCueIndex: findNextCueSortedIndex(orderedCues, firedCueIds),
    };
    emitState();
    void executeCueAction(nextCue);
  };

  const replayLastCue = (): void => {
    if (state.status !== 'running' || state.lastExecutedCueId === null) {
      return;
    }

    const cue = cueById.get(state.lastExecutedCueId);
    if (!cue) {
      return;
    }

    void executeCueAction(cue);
  };

  const dispose = (): void => {
    stop();
    listeners.clear();
  };

  return {
    getState: () => clonePlaybackState(state),
    subscribe: (listener: PlaybackStateListener) => {
      listeners.add(listener);
      listener(clonePlaybackState(state));

      return () => {
        listeners.delete(listener);
      };
    },
    start,
    pause,
    resume,
    stop,
    skipToNextCue,
    replayLastCue,
    dispose,
  };
}
