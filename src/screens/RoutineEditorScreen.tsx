import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CueRowEditor,
  FavoriteToggle,
  LabeledTextField,
  RoutineSettingsSection,
  TagInput,
} from '../components/editor';
import type { RootStackParamList } from '../navigation/types';
import { createRoutine, getRoutine, updateRoutine } from '../services';
import type { CueActionType, CueInputMode, HeadsUpOverride, SoundId } from '../types';
import { buildRoutineSavePayload, evaluateEditorDraft, toEditorCueTimeText } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineEditor'>;

interface CueDraft {
  id: string;
  timeText: string;
  inputMode: CueInputMode;
  actionType: CueActionType;
  ttsText: string;
  soundId: SoundId;
  headsUpOverride: HeadsUpOverride;
}

const DEFAULT_SOUND_ID: SoundId = 'beep';
let cueDraftIdCounter = 0;

function generateCueDraftId(): string {
  cueDraftIdCounter += 1;
  return `cue-draft-${cueDraftIdCounter}`;
}

function createDefaultCueDraft(overrides?: Partial<CueDraft>): CueDraft {
  return {
    id: overrides?.id ?? generateCueDraftId(),
    timeText: '00:00',
    inputMode: 'elapsed',
    actionType: 'tts',
    ttsText: '',
    soundId: DEFAULT_SOUND_ID,
    headsUpOverride: 'inherit',
    ...overrides,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error';
}

export default function RoutineEditorScreen({ navigation, route }: Props) {
  const routineId = route.params?.routineId;
  const isEditMode = typeof routineId === 'string' && routineId.length > 0;

  const [routineName, setRoutineName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [routineDurationText, setRoutineDurationText] = useState('');
  const [defaultHeadsUpEnabled, setDefaultHeadsUpEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [duckPlannedFlag, setDuckPlannedFlag] = useState(false);
  const [cueDrafts, setCueDrafts] = useState<CueDraft[]>([createDefaultCueDraft()]);
  const [isHydrating, setIsHydrating] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !routineId) {
      setIsHydrating(false);
      return;
    }

    let isActive = true;
    setIsHydrating(true);
    setSaveErrorMessage(null);

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

        setRoutineName(existingRoutine.name);
        setTagsText(existingRoutine.tags.join(', '));
        setFavorite(existingRoutine.favorite);
        setRoutineDurationText(toEditorCueTimeText(existingRoutine.routineDurationMs, 'elapsed', 0));
        setDefaultHeadsUpEnabled(existingRoutine.defaultHeadsUpEnabled);
        setHapticsEnabled(existingRoutine.hapticsEnabled);
        setDuckPlannedFlag(existingRoutine.duckPlannedFlag);
        setCueDrafts(
          existingRoutine.cues.map((cue) =>
            createDefaultCueDraft({
              id: cue.id,
              timeText: toEditorCueTimeText(
                cue.offsetMs,
                cue.inputMode,
                existingRoutine.routineDurationMs
              ),
              inputMode: cue.inputMode,
              actionType: cue.actionType,
              ttsText: cue.ttsText ?? '',
              soundId: cue.soundId ?? DEFAULT_SOUND_ID,
              headsUpOverride: cue.headsUpOverride,
            })
          )
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
        cues: cueDrafts,
      }),
    [cueDrafts, routineDurationText]
  );

  const saveMessages = useMemo(() => {
    const messages = [...editorEvaluation.issues.routineMessages];
    if (saveErrorMessage) {
      messages.push({ severity: 'error', message: saveErrorMessage });
    }

    return messages;
  }, [editorEvaluation.issues.routineMessages, saveErrorMessage]);

  const isBusy = isHydrating || isSaving;
  const isSaveDisabled = isBusy || editorEvaluation.issues.hasErrors;

  const saveHelperText = editorEvaluation.issues.hasErrors
    ? 'Resolve errors before saving.'
    : editorEvaluation.issues.hasWarnings
      ? 'Warnings found. Save is still allowed.'
      : isSaving
        ? 'Saving...'
        : 'Ready to save.';

  const updateCueDraftField = useCallback(
    <K extends keyof CueDraft>(cueId: string, field: K, value: CueDraft[K]) => {
      setSaveErrorMessage(null);
      setCueDrafts((previousCues) =>
        previousCues.map((cue) => (cue.id === cueId ? { ...cue, [field]: value } : cue))
      );
    },
    []
  );

  const moveCue = useCallback((cueIndex: number, direction: -1 | 1) => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => {
      const targetIndex = cueIndex + direction;
      if (cueIndex < 0 || cueIndex >= previousCues.length) {
        return previousCues;
      }

      if (targetIndex < 0 || targetIndex >= previousCues.length) {
        return previousCues;
      }

      const nextCues = [...previousCues];
      const [cueToMove] = nextCues.splice(cueIndex, 1);
      nextCues.splice(targetIndex, 0, cueToMove);
      return nextCues;
    });
  }, []);

  const duplicateCue = useCallback((cueIndex: number) => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => {
      if (cueIndex < 0 || cueIndex >= previousCues.length) {
        return previousCues;
      }

      const sourceCue = previousCues[cueIndex];
      const duplicatedCue = createDefaultCueDraft({
        timeText: sourceCue.timeText,
        inputMode: sourceCue.inputMode,
        actionType: sourceCue.actionType,
        ttsText: sourceCue.ttsText,
        soundId: sourceCue.soundId,
        headsUpOverride: sourceCue.headsUpOverride,
      });

      const nextCues = [...previousCues];
      nextCues.splice(cueIndex + 1, 0, duplicatedCue);
      return nextCues;
    });
  }, []);

  const deleteCue = useCallback((cueIndex: number) => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => {
      if (cueIndex < 0 || cueIndex >= previousCues.length) {
        return previousCues;
      }

      return previousCues.filter((_, index) => index !== cueIndex);
    });
  }, []);

  const addCue = useCallback(() => {
    setSaveErrorMessage(null);
    setCueDrafts((previousCues) => [...previousCues, createDefaultCueDraft()]);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaveDisabled || editorEvaluation.routineDurationMs === null) {
      return;
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
        defaultHeadsUpEnabled,
        hapticsEnabled,
        duckPlannedFlag,
        normalizedCues: editorEvaluation.normalizedCues,
      });

      if (payload.operation === 'create') {
        await createRoutine(payload.routine);
      } else {
        await updateRoutine(payload.routine);
      }

      navigation.navigate('Library');
    } catch (error: unknown) {
      setSaveErrorMessage(`Could not save routine. ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultHeadsUpEnabled,
    duckPlannedFlag,
    editorEvaluation.normalizedCues,
    editorEvaluation.routineDurationMs,
    favorite,
    hapticsEnabled,
    isEditMode,
    isSaveDisabled,
    navigation,
    routineId,
    routineName,
    tagsText,
  ]);

  return (
    <ScrollView
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
          setRoutineDurationText(value);
        }}
        defaultHeadsUpEnabled={defaultHeadsUpEnabled}
        onDefaultHeadsUpEnabledChange={(value) => {
          setSaveErrorMessage(null);
          setDefaultHeadsUpEnabled(value);
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
          editorEvaluation.issues.durationErrorText
            ? undefined
            : 'Required before using countdown cue times.'
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
                timeText={cue.timeText}
                inputMode={cue.inputMode}
                actionType={cue.actionType}
                ttsText={cue.ttsText}
                soundId={cue.soundId}
                headsUpOverride={cue.headsUpOverride}
                onTimeTextChange={(value) => updateCueDraftField(cue.id, 'timeText', value)}
                onInputModeChange={(value) => updateCueDraftField(cue.id, 'inputMode', value)}
                onActionTypeChange={(value) => updateCueDraftField(cue.id, 'actionType', value)}
                onTtsTextChange={(value) => updateCueDraftField(cue.id, 'ttsText', value)}
                onSoundIdChange={(value) => updateCueDraftField(cue.id, 'soundId', value)}
                onHeadsUpOverrideChange={(value) =>
                  updateCueDraftField(cue.id, 'headsUpOverride', value)
                }
                onMoveUp={() => moveCue(index, -1)}
                onMoveDown={() => moveCue(index, 1)}
                onDuplicate={() => duplicateCue(index)}
                onDelete={() => deleteCue(index)}
                disableMoveUp={index === 0}
                disableMoveDown={index === cueDrafts.length - 1}
                disabled={isBusy}
                timeErrorText={editorEvaluation.issues.cueTimeErrorById[cue.id]}
                timeHelperText={
                  editorEvaluation.issues.cueTimeErrorById[cue.id]
                    ? undefined
                    : editorEvaluation.issues.cueTimeWarningById[cue.id]
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
        <Pressable
          disabled={isSaveDisabled}
          onPress={() => void handleSave()}
          style={[styles.saveButton, isSaveDisabled ? styles.saveButtonDisabled : styles.saveButtonEnabled]}
        >
          <Text style={[styles.saveButtonLabel, isSaveDisabled ? styles.saveButtonLabelDisabled : styles.saveButtonLabelEnabled]}>
            {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Routine'}
          </Text>
        </Pressable>
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
