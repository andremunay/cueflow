import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CueRowEditor,
  FavoriteToggle,
  LabeledTextField,
  RoutineSettingsSection,
  TagInput,
} from '../components/editor';
import { DEFAULT_HEADS_UP_LEAD_TIME_MS, DEFAULT_ROUTINE_START_DELAY_MS } from '../constants';
import type { RootStackParamList } from '../navigation/types';
import { createRoutine, deleteRoutine, getRoutine, playSound, speakText, updateRoutine } from '../services';
import type { CueActionType, HeadsUpOverride, SoundId } from '../types';
import {
  autoOrderCueDraftsByNormalizedElapsed,
  buildCuePreviewCommands,
  buildRoutineSavePayload,
  createExpandedCueStateForAddedCue,
  evaluateEditorDraft,
  formatSettingsTimeInput,
  getCollapsedCueTimeLabel,
  isCuePreviewDisabled,
  parseAndNormalizeCueOffsetMs,
  parseCueTimeToMs,
  toggleCueExpandedState,
  toEditorCueTimeText,
} from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;

interface CueDraft {
  id: string;
  timeText: string;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
  headsUpLeadTimeText: string;
}

const DEFAULT_SOUND_ID: SoundId = 'beep';
const DEFAULT_START_DELAY_TEXT = toEditorCueTimeText(DEFAULT_ROUTINE_START_DELAY_MS);
const DEFAULT_HEADS_UP_LEAD_TIME_TEXT = toEditorCueTimeText(DEFAULT_HEADS_UP_LEAD_TIME_MS);
let cueDraftIdCounter = 0;

function generateCueDraftId(): string {
  cueDraftIdCounter += 1;
  return `cue-draft-${cueDraftIdCounter}`;
}

function createDefaultCueDraft(overrides?: Partial<CueDraft>): CueDraft {
  return {
    id: overrides?.id ?? generateCueDraftId(),
    timeText: '00:00',
    actionType: 'tts',
    ttsText: '',
    soundId: DEFAULT_SOUND_ID,
    headsUpOverride: 'inherit',
    headsUpLeadTimeText: '',
    ...overrides,
  };
}

function createAddedCueDraft(): CueDraft {
  return createDefaultCueDraft({
    timeText: '',
  });
}

function createInitialCueState(): { cueDrafts: CueDraft[]; expandedCueIds: Record<string, true> } {
  const initialCue = createDefaultCueDraft();
  return {
    cueDrafts: [initialCue],
    expandedCueIds: {
      [initialCue.id]: true,
    },
  };
}

function autoOrderCueDrafts(cues: CueDraft[], routineDurationText: string): CueDraft[] {
  return autoOrderCueDraftsByNormalizedElapsed({
    cues,
    routineDurationText,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

interface EditorSnapshotInput {
  routineName: string;
  tagsText: string;
  favorite: boolean;
  routineDurationText: string;
  startDelayText: string;
  headsUpEnabled: boolean;
  headsUpLeadTimeText: string;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  cueDrafts: CueDraft[];
}

function createEditorSnapshot(input: EditorSnapshotInput): string {
  return JSON.stringify({
    routineName: input.routineName,
    tagsText: input.tagsText,
    favorite: input.favorite,
    routineDurationText: input.routineDurationText,
    startDelayText: input.startDelayText,
    headsUpEnabled: input.headsUpEnabled,
    headsUpLeadTimeText: input.headsUpLeadTimeText,
    hapticsEnabled: input.hapticsEnabled,
    duckPlannedFlag: input.duckPlannedFlag,
    cueDrafts: input.cueDrafts,
  });
}

export default function RoutineEditorScreen({ navigation, route }: Props) {
  const routineId = route.params?.routineId;
  const isEditMode = typeof routineId === 'string' && routineId.length > 0;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const skipUnsavedPromptRef = useRef(false);
  const initialCueState = useMemo(() => createInitialCueState(), []);

  const [routineName, setRoutineName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [routineDurationText, setRoutineDurationText] = useState('');
  const [startDelayText, setStartDelayText] = useState(DEFAULT_START_DELAY_TEXT);
  const [headsUpEnabled, setHeadsUpEnabled] = useState(true);
  const [headsUpLeadTimeText, setHeadsUpLeadTimeText] = useState(DEFAULT_HEADS_UP_LEAD_TIME_TEXT);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [duckPlannedFlag, setDuckPlannedFlag] = useState(false);
  const [cueDrafts, setCueDrafts] = useState<CueDraft[]>(initialCueState.cueDrafts);
  const [expandedCueIds, setExpandedCueIds] = useState<Record<string, true>>(
    initialCueState.expandedCueIds
  );
  const [previewingCueId, setPreviewingCueId] = useState<string | null>(null);
  const [pendingAddedCueId, setPendingAddedCueId] = useState<string | null>(null);
  const [cueRowLayoutYById, setCueRowLayoutYById] = useState<Record<string, number>>({});
  const [isHydrating, setIsHydrating] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [savedEditorSnapshot, setSavedEditorSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !routineId) {
      setIsHydrating(false);
      setPendingAddedCueId(null);
      setSavedEditorSnapshot(null);
      return;
    }

    let isActive = true;
    setIsHydrating(true);
    setSaveErrorMessage(null);
    setSavedEditorSnapshot(null);

    void (async () => {
      try {
        const existingRoutine = await getRoutine(routineId);
        if (!isActive) {
          return;
        }

        if (!existingRoutine) {
          Alert.alert('Routine not found', 'That routine no longer exists.', [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Library'),
            },
          ]);
          return;
        }

        const hydratedRoutineDurationText = toEditorCueTimeText(
          existingRoutine.routineDurationMs
        );
        const hydratedCueDrafts = autoOrderCueDrafts(
          existingRoutine.cues.map((cue) =>
            createDefaultCueDraft({
              id: cue.id,
              timeText: toEditorCueTimeText(cue.offsetMs),
              actionType: cue.actionType,
              ttsText: cue.ttsText ?? '',
              soundId: cue.soundId ?? DEFAULT_SOUND_ID,
              headsUpOverride: cue.headsUpOverride,
              headsUpLeadTimeText:
                cue.headsUpLeadTimeMs !== undefined
                  ? toEditorCueTimeText(cue.headsUpLeadTimeMs)
                  : '',
            })
          ),
          hydratedRoutineDurationText
        );
        const hydratedStartDelayText = toEditorCueTimeText(existingRoutine.startDelayMs);
        const hydratedHeadsUpLeadTimeText = toEditorCueTimeText(existingRoutine.headsUpLeadTimeMs);

        setRoutineName(existingRoutine.name);
        setTagsText(existingRoutine.tags.join(', '));
        setFavorite(existingRoutine.favorite);
        setRoutineDurationText(hydratedRoutineDurationText);
        setStartDelayText(hydratedStartDelayText);
        setHeadsUpEnabled(existingRoutine.headsUpEnabled);
        setHeadsUpLeadTimeText(hydratedHeadsUpLeadTimeText);
        setHapticsEnabled(existingRoutine.hapticsEnabled);
        setDuckPlannedFlag(existingRoutine.duckPlannedFlag);
        setPendingAddedCueId(null);
        setCueRowLayoutYById({});
        setExpandedCueIds({});
        setCueDrafts(hydratedCueDrafts);
        setSavedEditorSnapshot(
          createEditorSnapshot({
            routineName: existingRoutine.name,
            tagsText: existingRoutine.tags.join(', '),
            favorite: existingRoutine.favorite,
            routineDurationText: hydratedRoutineDurationText,
            startDelayText: hydratedStartDelayText,
            headsUpEnabled: existingRoutine.headsUpEnabled,
            headsUpLeadTimeText: hydratedHeadsUpLeadTimeText,
            hapticsEnabled: existingRoutine.hapticsEnabled,
            duckPlannedFlag: existingRoutine.duckPlannedFlag,
            cueDrafts: hydratedCueDrafts,
          })
        );
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        Alert.alert('Could not load routine', getErrorMessage(error), [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Library'),
          },
        ]);
      } finally {
        if (isActive) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isEditMode, navigation, routineId]);

  const editorEvaluation = useMemo(
    () =>
      evaluateEditorDraft({
        routineDurationText,
        startDelayText,
        headsUpEnabled,
        headsUpLeadTimeText,
        cues: cueDrafts,
      }),
    [cueDrafts, headsUpEnabled, headsUpLeadTimeText, routineDurationText, startDelayText]
  );

  const saveMessages = useMemo(() => {
    const messages = [...editorEvaluation.issues.routineMessages];
    if (saveErrorMessage) {
      messages.push({ severity: 'error', message: saveErrorMessage });
    }

    return messages;
  }, [editorEvaluation.issues.routineMessages, saveErrorMessage]);

  const currentEditorSnapshot = useMemo(
    () =>
      createEditorSnapshot({
        routineName,
        tagsText,
        favorite,
        routineDurationText,
        startDelayText,
        headsUpEnabled,
        headsUpLeadTimeText,
        hapticsEnabled,
        duckPlannedFlag,
        cueDrafts,
      }),
    [
      cueDrafts,
      duckPlannedFlag,
      favorite,
      hapticsEnabled,
      headsUpEnabled,
      headsUpLeadTimeText,
      routineDurationText,
      routineName,
      startDelayText,
      tagsText,
    ]
  );

  useEffect(() => {
    if (!isHydrating && savedEditorSnapshot === null) {
      setSavedEditorSnapshot(currentEditorSnapshot);
    }
  }, [currentEditorSnapshot, isHydrating, savedEditorSnapshot]);

  const hasUnsavedChanges =
    !isHydrating && savedEditorSnapshot !== null && currentEditorSnapshot !== savedEditorSnapshot;

  const isBusy = isHydrating || isSaving || isDeleting;
  const isSaveDisabled = isBusy || editorEvaluation.issues.hasErrors;
  const canPlaySavedRoutine = isEditMode && Boolean(routineId) && !isBusy;

  const saveHelperText = editorEvaluation.issues.hasErrors
    ? 'Resolve errors before saving.'
    : editorEvaluation.issues.hasWarnings
      ? 'Warnings found. Save is still allowed.'
      : isDeleting
        ? 'Deleting...'
      : isSaving
        ? 'Saving...'
        : 'Ready to save.';

  const updateCueRowLayoutY = useCallback((cueId: string, layoutY: number) => {
    setCueRowLayoutYById((previousLayoutYById) => {
      if (previousLayoutYById[cueId] === layoutY) {
        return previousLayoutYById;
      }

      return {
        ...previousLayoutYById,
        [cueId]: layoutY,
      };
    });
  }, []);

  const updateCueDraftField = useCallback(
    <K extends keyof CueDraft>(cueId: string, field: K, value: CueDraft[K]) => {
      setSaveErrorMessage(null);
      const nextFieldValue =
        (field === 'timeText' || field === 'headsUpLeadTimeText') && typeof value === 'string'
          ? (formatSettingsTimeInput(value) as CueDraft[K])
          : value;
      setCueDrafts((previousCues) => {
        const nextCues = previousCues.map((cue) =>
          cue.id === cueId ? { ...cue, [field]: nextFieldValue } : cue
        );

        if (field !== 'timeText') {
          return nextCues;
        }

        return autoOrderCueDrafts(nextCues, routineDurationText);
      });
    },
    [routineDurationText]
  );

  const handleCueHeadsUpOverrideChange = useCallback(
    (cueId: string, value: HeadsUpOverride) => {
      setSaveErrorMessage(null);
      setCueDrafts((previousCues) =>
        previousCues.map((cue) => {
          if (cue.id !== cueId) {
            return cue;
          }

          if (value !== 'on') {
            return {
              ...cue,
              headsUpOverride: value,
            };
          }

          return {
            ...cue,
            headsUpOverride: value,
            headsUpLeadTimeText:
              cue.headsUpLeadTimeText.trim().length > 0
                ? cue.headsUpLeadTimeText
                : headsUpLeadTimeText,
          };
        })
      );
    },
    [headsUpLeadTimeText]
  );

  useEffect(() => {
    if (!pendingAddedCueId) {
      return;
    }

    const pendingCue = cueDrafts.find((cue) => cue.id === pendingAddedCueId);
    if (!pendingCue) {
      setPendingAddedCueId(null);
      return;
    }

    const parsedRoutineDuration = parseCueTimeToMs(routineDurationText);
    const normalizedPendingCueOffset = parseAndNormalizeCueOffsetMs({
      input: pendingCue.timeText,
      routineDurationMs: parsedRoutineDuration.ok ? parsedRoutineDuration.value : undefined,
    });

    if (!normalizedPendingCueOffset.ok) {
      return;
    }

    const cueRowY = cueRowLayoutYById[pendingAddedCueId];
    if (typeof cueRowY !== 'number') {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, cueRowY - 16),
      animated: true,
    });
    setPendingAddedCueId(null);
  }, [cueDrafts, cueRowLayoutYById, pendingAddedCueId, routineDurationText]);

  const duplicateCue = useCallback((cueId: string) => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => {
      const cueIndex = previousCues.findIndex((cue) => cue.id === cueId);
      if (cueIndex < 0) {
        return previousCues;
      }

      const sourceCue = previousCues[cueIndex];
      const duplicatedCue = createDefaultCueDraft({
        timeText: sourceCue.timeText,
        actionType: sourceCue.actionType,
        ttsText: sourceCue.ttsText,
        soundId: sourceCue.soundId,
        headsUpOverride: sourceCue.headsUpOverride,
        headsUpLeadTimeText: sourceCue.headsUpLeadTimeText,
      });

      const nextCues = [...previousCues];
      nextCues.splice(cueIndex + 1, 0, duplicatedCue);
      return autoOrderCueDrafts(nextCues, routineDurationText);
    });
  }, [routineDurationText]);

  const deleteCue = useCallback((cueId: string) => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => previousCues.filter((cue) => cue.id !== cueId));
    setExpandedCueIds((previousExpandedCueIds) => {
      if (!(cueId in previousExpandedCueIds)) {
        return previousExpandedCueIds;
      }

      const nextExpandedCueIds = { ...previousExpandedCueIds };
      delete nextExpandedCueIds[cueId];
      return nextExpandedCueIds;
    });
    setCueRowLayoutYById((previousLayoutYById) => {
      if (!(cueId in previousLayoutYById)) {
        return previousLayoutYById;
      }

      const nextLayoutYById = { ...previousLayoutYById };
      delete nextLayoutYById[cueId];
      return nextLayoutYById;
    });
    setPendingAddedCueId((activeCueId) => (activeCueId === cueId ? null : activeCueId));
  }, []);

  const addCue = useCallback(() => {
    setSaveErrorMessage(null);
    const addedCue = createAddedCueDraft();
    setPendingAddedCueId(addedCue.id);
    setExpandedCueIds(createExpandedCueStateForAddedCue(addedCue.id));
    setCueDrafts((previousCues) =>
      autoOrderCueDrafts([...previousCues, addedCue], routineDurationText)
    );
  }, [routineDurationText]);

  const toggleCueCollapsed = useCallback((cueId: string) => {
    setExpandedCueIds((previousExpandedCueIds) =>
      toggleCueExpandedState(previousExpandedCueIds, cueId)
    );
  }, []);

  const previewCue = useCallback(
    async (cue: CueDraft) => {
      if (isBusy || previewingCueId !== null) {
        return;
      }

      const commands = buildCuePreviewCommands({
        actionType: cue.actionType,
        ttsText: cue.ttsText,
        soundId: cue.soundId,
      });

      if (commands.length === 0) {
        return;
      }

      setPreviewingCueId(cue.id);
      try {
        for (const command of commands) {
          if (command.type === 'sound') {
            await playSound(command.soundId);
          } else {
            await speakText(command.text);
          }
        }
      } catch {
        // Preview should not block editing if media APIs fail.
      } finally {
        setPreviewingCueId((activeCueId) => (activeCueId === cue.id ? null : activeCueId));
      }
    },
    [isBusy, previewingCueId]
  );

  const persistRoutine = useCallback(async (): Promise<boolean> => {
    if (
      isSaveDisabled ||
      editorEvaluation.routineDurationMs === null ||
      editorEvaluation.startDelayMs === null ||
      editorEvaluation.headsUpLeadTimeMs === null
    ) {
      return false;
    }

    setSaveErrorMessage(null);
    setIsSaving(true);

    try {
      const payload = buildRoutineSavePayload({
        mode: isEditMode ? 'update' : 'create',
        routineId,
        routineName,
        tagsText,
        favorite,
        routineDurationMs: editorEvaluation.routineDurationMs,
        startDelayMs: editorEvaluation.startDelayMs,
        headsUpEnabled,
        headsUpLeadTimeMs: editorEvaluation.headsUpLeadTimeMs,
        hapticsEnabled,
        duckPlannedFlag,
        normalizedCues: editorEvaluation.normalizedCues,
      });

      if (payload.operation === 'create') {
        await createRoutine(payload.routine);
      } else {
        await updateRoutine(payload.routine);
      }

      setSavedEditorSnapshot(currentEditorSnapshot);
      return true;
    } catch (error: unknown) {
      setSaveErrorMessage(`Could not save routine. ${getErrorMessage(error)}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    currentEditorSnapshot,
    headsUpEnabled,
    duckPlannedFlag,
    editorEvaluation.headsUpLeadTimeMs,
    editorEvaluation.normalizedCues,
    editorEvaluation.routineDurationMs,
    editorEvaluation.startDelayMs,
    favorite,
    hapticsEnabled,
    isEditMode,
    isSaveDisabled,
    routineId,
    routineName,
    tagsText,
  ]);

  const completeNavigationWithoutPrompt = useCallback(
    (action: () => void) => {
      skipUnsavedPromptRef.current = true;
      action();
      setTimeout(() => {
        skipUnsavedPromptRef.current = false;
      }, 0);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const saved = await persistRoutine();
    if (!saved) {
      return;
    }

    completeNavigationWithoutPrompt(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Library');
      }
    });
  }, [completeNavigationWithoutPrompt, navigation, persistRoutine]);

  const handleDeleteRoutine = useCallback(() => {
    if (!isEditMode || !routineId || isBusy) {
      return;
    }

    Alert.alert('Delete routine?', 'This will permanently delete this routine.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaveErrorMessage(null);
            setIsDeleting(true);
            try {
              const deleted = await deleteRoutine(routineId);
              if (!deleted) {
                throw new Error('Routine not found.');
              }

              completeNavigationWithoutPrompt(() => {
                navigation.navigate('Library');
              });
            } catch (error: unknown) {
              setSaveErrorMessage(`Could not delete routine. ${getErrorMessage(error)}`);
            } finally {
              setIsDeleting(false);
            }
          })();
        },
      },
    ]);
  }, [completeNavigationWithoutPrompt, isBusy, isEditMode, navigation, routineId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!hasUnsavedChanges || isBusy || skipUnsavedPromptRef.current) {
        return;
      }

      event.preventDefault();

      Alert.alert('Unsaved changes', 'Save changes before leaving this routine?', [
        {
          text: 'Save',
          onPress: () => {
            void (async () => {
              const saved = await persistRoutine();
              if (!saved) {
                return;
              }

              completeNavigationWithoutPrompt(() => {
                navigation.dispatch(event.data.action);
              });
            })();
          },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            completeNavigationWithoutPrompt(() => {
              navigation.dispatch(event.data.action);
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]);
    });

    return unsubscribe;
  }, [
    completeNavigationWithoutPrompt,
    hasUnsavedChanges,
    isBusy,
    navigation,
    persistRoutine,
  ]);

  const handlePlaySavedRoutine = useCallback(() => {
    if (!routineId) {
      return;
    }

    navigation.navigate('Playback', { routineId });
  }, [navigation, routineId]);

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      style={styles.container}
    >
      <Text style={styles.title}>Routine Editor</Text>

      <View style={styles.section}>
        <LabeledTextField
          label="Routine name"
          value={routineName}
          onChangeText={(value) => {
            setSaveErrorMessage(null);
            setRoutineName(value);
          }}
          placeholder="Morning workout"
          returnKeyType="done"
          editable={!isBusy}
        />
        <TagInput
          value={tagsText}
          onChangeText={(value) => {
            setSaveErrorMessage(null);
            setTagsText(value);
          }}
          editable={!isBusy}
        />
        <FavoriteToggle
          value={favorite}
          onValueChange={(value) => {
            setSaveErrorMessage(null);
            setFavorite(value);
          }}
          disabled={isBusy}
        />
      </View>

      <RoutineSettingsSection
        durationText={routineDurationText}
        onDurationTextChange={(value) => {
          setSaveErrorMessage(null);
          const formattedValue = formatSettingsTimeInput(value);
          setRoutineDurationText(formattedValue);
          setCueDrafts((previousCues) => autoOrderCueDrafts(previousCues, formattedValue));
        }}
        startDelayText={startDelayText}
        onStartDelayTextChange={(value) => {
          setSaveErrorMessage(null);
          setStartDelayText(formatSettingsTimeInput(value));
        }}
        headsUpEnabled={headsUpEnabled}
        onHeadsUpEnabledChange={(value) => {
          setSaveErrorMessage(null);
          setHeadsUpEnabled(value);
          if (value) {
            setHeadsUpLeadTimeText(DEFAULT_HEADS_UP_LEAD_TIME_TEXT);
          }
        }}
        headsUpLeadTimeText={headsUpLeadTimeText}
        onHeadsUpLeadTimeTextChange={(value) => {
          setSaveErrorMessage(null);
          setHeadsUpLeadTimeText(formatSettingsTimeInput(value));
        }}
        hapticsEnabled={hapticsEnabled}
        onHapticsEnabledChange={(value) => {
          setSaveErrorMessage(null);
          setHapticsEnabled(value);
        }}
        duckPlannedFlag={duckPlannedFlag}
        onDuckPlannedFlagChange={(value) => {
          setSaveErrorMessage(null);
          setDuckPlannedFlag(value);
        }}
        durationErrorText={editorEvaluation.issues.durationErrorText}
        durationHelperText={
          editorEvaluation.issues.durationErrorText ? undefined : 'Required.'
        }
        startDelayErrorText={editorEvaluation.issues.startDelayErrorText}
        startDelayHelperText={
          editorEvaluation.issues.startDelayErrorText
            ? undefined
            : 'Delay before playback timeline begins.'
        }
        headsUpLeadTimeErrorText={editorEvaluation.issues.headsUpLeadTimeErrorText}
        headsUpLeadTimeHelperText={
          editorEvaluation.issues.headsUpLeadTimeErrorText
            ? undefined
            : 'Ping lead time before each cue when heads-up is enabled.'
        }
        disabled={isBusy}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cues</Text>
          <Text style={styles.sectionSubtitle}>
            {cueDrafts.length} {cueDrafts.length === 1 ? 'cue' : 'cues'}
          </Text>
        </View>

        {cueDrafts.length === 0 ? (
          <Text style={styles.emptyCuesText}>No cues yet. Add a cue to get started.</Text>
        ) : (
          <View style={styles.cueList}>
            {cueDrafts.map((cue, index) => (
              <CueRowEditor
                key={cue.id}
                cueLabel={`Cue ${index + 1}`}
                collapsedTimeLabel={getCollapsedCueTimeLabel(cue.timeText)}
                collapsed={!expandedCueIds[cue.id]}
                onToggleCollapsed={() => toggleCueCollapsed(cue.id)}
                timeText={cue.timeText}
                actionType={cue.actionType}
                ttsText={cue.ttsText}
                soundId={cue.soundId}
                headsUpOverride={cue.headsUpOverride}
                headsUpLeadTimeText={cue.headsUpLeadTimeText}
                onTimeTextChange={(value) => updateCueDraftField(cue.id, 'timeText', value)}
                onActionTypeChange={(value) => updateCueDraftField(cue.id, 'actionType', value)}
                onTtsTextChange={(value) => updateCueDraftField(cue.id, 'ttsText', value)}
                onSoundIdChange={(value) => updateCueDraftField(cue.id, 'soundId', value)}
                onHeadsUpOverrideChange={(value) => handleCueHeadsUpOverrideChange(cue.id, value)}
                onHeadsUpLeadTimeTextChange={(value) =>
                  updateCueDraftField(cue.id, 'headsUpLeadTimeText', value)
                }
                onPreview={() => void previewCue(cue)}
                onDuplicate={() => duplicateCue(cue.id)}
                onDelete={() => deleteCue(cue.id)}
                previewDisabled={
                  isBusy ||
                  previewingCueId !== null ||
                  isCuePreviewDisabled(cue.actionType, cue.ttsText)
                }
                previewLoading={previewingCueId === cue.id}
                cueTimeAutoFocus={pendingAddedCueId === cue.id}
                onLayout={(event) => updateCueRowLayoutY(cue.id, event.nativeEvent.layout.y)}
                disabled={isBusy}
                timeErrorText={editorEvaluation.issues.cueTimeErrorById[cue.id]}
                timeHelperText={
                  editorEvaluation.issues.cueTimeErrorById[cue.id]
                    ? undefined
                    : editorEvaluation.issues.cueTimeWarningById[cue.id]
                }
                headsUpLeadTimeErrorText={
                  editorEvaluation.issues.cueHeadsUpLeadTimeErrorById[cue.id]
                }
                headsUpLeadTimeHelperText={
                  editorEvaluation.issues.cueHeadsUpLeadTimeErrorById[cue.id]
                    ? undefined
                    : 'Overrides routine heads-up lead time for this cue.'
                }
              />
            ))}
          </View>
        )}

        <Pressable disabled={isBusy} onPress={addCue} style={styles.addCueButton}>
          <Text style={styles.addCueButtonLabel}>Add Cue</Text>
        </Pressable>
      </View>

      <View style={styles.saveSection}>
        {isEditMode ? (
          <View style={styles.playSavedSection}>
            <Pressable
              disabled={!canPlaySavedRoutine}
              onPress={handlePlaySavedRoutine}
              style={[
                styles.playSavedButton,
                canPlaySavedRoutine ? styles.playSavedButtonEnabled : styles.playSavedButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.playSavedButtonLabel,
                  canPlaySavedRoutine
                    ? styles.playSavedButtonLabelEnabled
                    : styles.playSavedButtonLabelDisabled,
                ]}
              >
                Play Saved Routine
              </Text>
            </Pressable>
            <Text style={styles.playSavedHelperText}>Runs the last saved version of this routine.</Text>
          </View>
        ) : null}
        <Pressable
          disabled={isSaveDisabled}
          onPress={() => void handleSave()}
          style={[styles.saveButton, isSaveDisabled ? styles.saveButtonDisabled : styles.saveButtonEnabled]}
        >
          <Text style={[styles.saveButtonLabel, isSaveDisabled ? styles.saveButtonLabelDisabled : styles.saveButtonLabelEnabled]}>
            {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Routine'}
          </Text>
        </Pressable>
        {isEditMode ? (
          <Pressable
            disabled={isBusy}
            onPress={handleDeleteRoutine}
            style={[
              styles.deleteRoutineButton,
              isBusy ? styles.deleteRoutineButtonDisabled : styles.deleteRoutineButtonEnabled,
            ]}
          >
            <Text
              style={[
                styles.deleteRoutineButtonLabel,
                isBusy ? styles.deleteRoutineButtonLabelDisabled : styles.deleteRoutineButtonLabelEnabled,
              ]}
            >
              {isDeleting ? 'Deleting...' : 'Delete Routine'}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.saveHelperText}>{saveHelperText}</Text>
        {isHydrating ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2E5BFF" />
            <Text style={styles.loadingText}>Loading routine...</Text>
          </View>
        ) : null}
        {saveMessages.map((message, index) => (
          <Text
            key={`${message.severity}-${index}`}
            style={message.severity === 'error' ? styles.errorMessageText : styles.warningMessageText}
          >
            {message.message}
          </Text>
        ))}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#161616',
  },
  section: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#555555',
  },
  cueList: {
    gap: 10,
  },
  emptyCuesText: {
    fontSize: 14,
    color: '#585858',
  },
  addCueButton: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#2E5BFF',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#ECF1FF',
  },
  addCueButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3CAA',
  },
  saveSection: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  playSavedSection: {
    marginBottom: 12,
  },
  playSavedButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  playSavedButtonEnabled: {
    backgroundColor: '#ECF1FF',
    borderWidth: 1,
    borderColor: '#2E5BFF',
  },
  playSavedButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D8D8D8',
  },
  playSavedButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  playSavedButtonLabelEnabled: {
    color: '#1B3CAA',
  },
  playSavedButtonLabelDisabled: {
    color: '#8A8A8A',
  },
  playSavedHelperText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
  },
  deleteRoutineButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteRoutineButtonEnabled: {
    borderColor: '#C62828',
    backgroundColor: '#FFEAEA',
  },
  deleteRoutineButtonDisabled: {
    borderColor: '#D8D8D8',
    backgroundColor: '#F5F5F5',
  },
  deleteRoutineButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteRoutineButtonLabelEnabled: {
    color: '#B00020',
  },
  deleteRoutineButtonLabelDisabled: {
    color: '#8A8A8A',
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#EFEFEF',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  saveButtonEnabled: {
    backgroundColor: '#2E5BFF',
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonLabelDisabled: {
    color: '#7A7A7A',
  },
  saveButtonLabelEnabled: {
    color: '#FFFFFF',
  },
  saveHelperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666666',
  },
  loadingRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 13,
    color: '#444444',
  },
  errorMessageText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B00020',
  },
  warningMessageText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8A5A00',
  },
});
