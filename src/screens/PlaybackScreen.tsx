import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { buildOrderedPlaybackCues, createPlaybackController, getRoutine } from '../services';
import type { PlaybackController } from '../services';
import type { Cue, PlaybackState, Routine } from '../types';
import { formatCueTimeFromMs } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Playback'>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

function formatClock(ms: number): string {
  const roundedMs = Math.max(0, Math.floor(ms / 1000) * 1000);
  const formatted = formatCueTimeFromMs(roundedMs);
  return formatted.ok ? formatted.value : '00:00';
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function describeCueAction(cue: Cue): string {
  const text = cue.ttsText?.trim() ?? '';
  const shortText = text.length > 0 ? `"${truncateText(text, 30)}"` : null;

  switch (cue.actionType) {
    case 'tts':
      return shortText ? `TTS ${shortText}` : 'TTS';
    case 'sound':
      return `Sound (${cue.soundId ?? 'beep'})`;
    case 'combo':
      return shortText
        ? `Combo (${cue.soundId ?? 'beep'} + ${shortText})`
        : `Combo (${cue.soundId ?? 'beep'} + voice)`;
    default:
      return 'Cue action';
  }
}

function formatStatusLabel(status: PlaybackState['status']): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
    case 'stopped':
      return 'Stopped';
    case 'completed':
      return 'Completed';
    default:
      return 'Idle';
  }
}

interface ControlButtonProps {
  label: string;
  onPress: () => void;
  disabled: boolean;
}

function ControlButton({ label, onPress, disabled }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.controlButton, disabled ? styles.controlButtonDisabled : styles.controlButtonEnabled]}
    >
      <Text
        style={[
          styles.controlButtonLabel,
          disabled ? styles.controlButtonLabelDisabled : styles.controlButtonLabelEnabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function PlaybackScreen({ route }: Props) {
  const routineId = route.params?.routineId;
  const controllerRef = useRef<PlaybackController | null>(null);

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [isLoadingRoutine, setIsLoadingRoutine] = useState(false);
  const [isRoutineMissing, setIsRoutineMissing] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);

  useEffect(() => {
    let isActive = true;

    setPlaybackState(null);

    if (!routineId) {
      setRoutine(null);
      setIsRoutineMissing(true);
      setLoadErrorMessage(null);
      setIsLoadingRoutine(false);
      return () => {
        isActive = false;
      };
    }

    setRoutine(null);
    setIsRoutineMissing(false);
    setLoadErrorMessage(null);
    setIsLoadingRoutine(true);

    void (async () => {
      try {
        const loadedRoutine = await getRoutine(routineId);
        if (!isActive) {
          return;
        }

        if (!loadedRoutine) {
          setRoutine(null);
          setIsRoutineMissing(true);
          return;
        }

        setRoutine(loadedRoutine);
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        setRoutine(null);
        setLoadErrorMessage(`Could not load routine. ${getErrorMessage(error)}`);
      } finally {
        if (isActive) {
          setIsLoadingRoutine(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [routineId]);

  useEffect(() => {
    if (!routine) {
      setPlaybackState(null);
      return;
    }

    const controller = createPlaybackController({ routine });
    controllerRef.current = controller;

    const unsubscribe = controller.subscribe((nextState) => {
      setPlaybackState(nextState);
    });

    return () => {
      unsubscribe();
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [routine]);

  const orderedCues = useMemo(() => {
    if (!routine) {
      return [];
    }

    return buildOrderedPlaybackCues(routine.cues);
  }, [routine]);

  const nextOrderedCue = useMemo(() => {
    const nextCueIndex = playbackState?.nextCueIndex ?? -1;
    if (nextCueIndex < 0) {
      return null;
    }

    return orderedCues[nextCueIndex] ?? null;
  }, [orderedCues, playbackState?.nextCueIndex]);

  const firedCueIds = useMemo(
    () => new Set(playbackState?.firedCueIds ?? []),
    [playbackState?.firedCueIds]
  );

  const status = playbackState?.status ?? 'idle';
  const canStart = Boolean(
    routine && (status === 'idle' || status === 'stopped' || status === 'completed')
  );
  const canPause = status === 'running';
  const canResume = status === 'paused';
  const canStop = status === 'running' || status === 'paused' || status === 'completed';
  const canSkipNext = status === 'running' && (playbackState?.nextCueIndex ?? -1) >= 0;
  const canReplayLast = status === 'running' && playbackState?.lastExecutedCueId !== null;

  const handleStart = useCallback(() => {
    controllerRef.current?.start();
  }, []);

  const handlePause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    controllerRef.current?.resume();
  }, []);

  const handleStop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const handleSkipNext = useCallback(() => {
    controllerRef.current?.skipToNextCue();
  }, []);

  const handleReplayLast = useCallback(() => {
    controllerRef.current?.replayLastCue();
  }, []);

  if (isLoadingRoutine) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#2E5BFF" />
        <Text style={styles.stateText}>Loading routine...</Text>
      </View>
    );
  }

  if (loadErrorMessage) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>Playback unavailable</Text>
        <Text style={styles.errorText}>{loadErrorMessage}</Text>
      </View>
    );
  }

  if (!routine || isRoutineMissing) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>No routine selected</Text>
        <Text style={styles.stateText}>
          {routineId
            ? `Could not find routine "${routineId}" for playback.`
            : 'Open Playback with a routine id to begin.'}
        </Text>
      </View>
    );
  }

  const elapsedClock = formatClock(playbackState?.elapsedMs ?? 0);
  const routineDuration = formatClock(routine.routineDurationMs);
  const nextCueTime = nextOrderedCue ? formatClock(nextOrderedCue.cue.offsetMs) : '--:--';
  const nextCueAction = nextOrderedCue ? describeCueAction(nextOrderedCue.cue) : 'No upcoming cue';

  return (
    <ScrollView contentContainerStyle={styles.contentContainer} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.routineName}>{routine.name || 'Untitled routine'}</Text>
        <Text style={styles.statusText}>Status: {formatStatusLabel(status)}</Text>
        <Text style={styles.clockText}>
          Elapsed: {elapsedClock} / {routineDuration}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next Cue</Text>
        <Text style={styles.nextCueTime}>{nextCueTime}</Text>
        <Text style={styles.nextCueAction}>{nextCueAction}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Controls</Text>
        <View style={styles.controlsRow}>
          <ControlButton label="Start" onPress={handleStart} disabled={!canStart} />
          <ControlButton label="Pause" onPress={handlePause} disabled={!canPause} />
          <ControlButton label="Resume" onPress={handleResume} disabled={!canResume} />
        </View>
        <View style={styles.controlsRow}>
          <ControlButton label="Stop" onPress={handleStop} disabled={!canStop} />
          <ControlButton label="Skip Next" onPress={handleSkipNext} disabled={!canSkipNext} />
          <ControlButton label="Replay Last" onPress={handleReplayLast} disabled={!canReplayLast} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upcoming Cues</Text>
        {orderedCues.length === 0 ? (
          <Text style={styles.emptyCuesText}>This routine has no cues.</Text>
        ) : (
          <View style={styles.cuesList}>
            {orderedCues.map((orderedCue) => {
              const isCurrentCue =
                orderedCue.sortedIndex === (playbackState?.nextCueIndex ?? -1) &&
                (playbackState?.nextCueIndex ?? -1) >= 0;
              const isFiredCue = firedCueIds.has(orderedCue.cue.id);

              return (
                <View
                  key={orderedCue.cue.id}
                  style={[
                    styles.cueRow,
                    isCurrentCue ? styles.cueRowCurrent : undefined,
                    isFiredCue ? styles.cueRowFired : undefined,
                  ]}
                >
                  <Text style={[styles.cueTimeText, isFiredCue ? styles.cueTextFired : undefined]}>
                    {formatClock(orderedCue.cue.offsetMs)}
                  </Text>
                  <Text style={[styles.cueActionText, isFiredCue ? styles.cueTextFired : undefined]}>
                    {describeCueAction(orderedCue.cue)}
                  </Text>
                  {isCurrentCue ? <Text style={styles.cueBadge}>Current</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F7F7F8',
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#161616',
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    textAlign: 'center',
    color: '#4B4B4B',
  },
  errorText: {
    marginTop: 10,
    fontSize: 15,
    textAlign: 'center',
    color: '#B00020',
  },
  card: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  routineName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#161616',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3C3C3C',
  },
  clockText: {
    fontSize: 16,
    color: '#202020',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  nextCueTime: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E5BFF',
  },
  nextCueAction: {
    fontSize: 15,
    color: '#3A3A3A',
  },
  controlsRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonEnabled: {
    backgroundColor: '#2E5BFF',
  },
  controlButtonDisabled: {
    backgroundColor: '#EFEFEF',
    borderWidth: 1,
    borderColor: '#D4D4D4',
  },
  controlButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  controlButtonLabelEnabled: {
    color: '#FFFFFF',
  },
  controlButtonLabelDisabled: {
    color: '#7A7A7A',
  },
  emptyCuesText: {
    fontSize: 14,
    color: '#585858',
  },
  cuesList: {
    gap: 8,
  },
  cueRow: {
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  cueRowCurrent: {
    borderColor: '#2E5BFF',
    backgroundColor: '#ECF1FF',
  },
  cueRowFired: {
    backgroundColor: '#F2F2F2',
  },
  cueTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cueActionText: {
    fontSize: 14,
    color: '#404040',
  },
  cueTextFired: {
    color: '#6A6A6A',
  },
  cueBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3CAA',
    backgroundColor: '#DCE7FF',
  },
});
