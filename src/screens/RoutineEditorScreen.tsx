import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CueRowEditor,
  FavoriteToggle,
  LabeledTextField,
  RoutineSettingsSection,
  TagInput,
} from '../components/editor';
import type { CueActionType, CueInputMode, HeadsUpOverride, SoundId } from '../types';

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

function createDefaultCueDraft(overrides?: Partial<Omit<CueDraft, 'id'>>): CueDraft {
  return {
    id: generateCueDraftId(),
    timeText: '00:00',
    inputMode: 'elapsed',
    actionType: 'tts',
    ttsText: '',
    soundId: DEFAULT_SOUND_ID,
    headsUpOverride: 'inherit',
    ...overrides,
  };
}

export default function RoutineEditorScreen() {
  const [routineName, setRoutineName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [routineDurationText, setRoutineDurationText] = useState('');
  const [defaultHeadsUpEnabled, setDefaultHeadsUpEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [duckPlannedFlag, setDuckPlannedFlag] = useState(false);
  const [cueDrafts, setCueDrafts] = useState<CueDraft[]>([createDefaultCueDraft()]);

  const updateCueDraftField = useCallback(
    <K extends keyof CueDraft>(cueId: string, field: K, value: CueDraft[K]) => {
      setCueDrafts((previousCues) =>
        previousCues.map((cue) => (cue.id === cueId ? { ...cue, [field]: value } : cue))
      );
    },
    []
  );

  const moveCue = useCallback((cueIndex: number, direction: -1 | 1) => {
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
    setCueDrafts((previousCues) => {
      if (cueIndex < 0 || cueIndex >= previousCues.length) {
        return previousCues;
      }

      return previousCues.filter((_, index) => index !== cueIndex);
    });
  }, []);

  const addCue = useCallback(() => {
    setCueDrafts((previousCues) => [...previousCues, createDefaultCueDraft()]);
  }, []);

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
          onChangeText={setRoutineName}
          placeholder="Morning workout"
          returnKeyType="done"
        />
        <TagInput value={tagsText} onChangeText={setTagsText} />
        <FavoriteToggle value={favorite} onValueChange={setFavorite} />
      </View>

      <RoutineSettingsSection
        durationText={routineDurationText}
        onDurationTextChange={setRoutineDurationText}
        defaultHeadsUpEnabled={defaultHeadsUpEnabled}
        onDefaultHeadsUpEnabledChange={setDefaultHeadsUpEnabled}
        hapticsEnabled={hapticsEnabled}
        onHapticsEnabledChange={setHapticsEnabled}
        duckPlannedFlag={duckPlannedFlag}
        onDuckPlannedFlagChange={setDuckPlannedFlag}
        durationHelperText="Required before using countdown cue times."
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
              />
            ))}
          </View>
        )}

        <Pressable onPress={addCue} style={styles.addCueButton}>
          <Text style={styles.addCueButtonLabel}>Add Cue</Text>
        </Pressable>
      </View>

      <View style={styles.saveSection}>
        <Pressable disabled style={[styles.saveButton, styles.saveButtonDisabled]}>
          <Text style={[styles.saveButtonLabel, styles.saveButtonLabelDisabled]}>Save (Step 10)</Text>
        </Pressable>
        <Text style={styles.saveHelperText}>
          Save wiring, normalization, and validation will be added in Step 10.
        </Text>
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
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonLabelDisabled: {
    color: '#7A7A7A',
  },
  saveHelperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666666',
  },
});
