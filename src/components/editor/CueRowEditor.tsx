import { StyleSheet, Text, View } from 'react-native';

import type { CueActionType, CueInputMode, HeadsUpOverride, SoundId } from '../../types';
import ActionTypeSelector from './ActionTypeSelector';
import CueRowActions from './CueRowActions';
import HeadsUpOverrideSelector from './HeadsUpOverrideSelector';
import LabeledTextField from './LabeledTextField';
import SegmentedOptionSelector, { type SegmentedOption } from './SegmentedOptionSelector';
import SoundSelector from './SoundSelector';

const INPUT_MODE_OPTIONS: readonly SegmentedOption<CueInputMode>[] = [
  { label: 'Elapsed', value: 'elapsed' },
  { label: 'Countdown', value: 'countdown' },
];

export interface CueRowEditorProps {
  cueLabel?: string;
  timeText: string;
  inputMode: CueInputMode;
  actionType: CueActionType;
  ttsText: string;
  soundId?: SoundId;
  headsUpOverride: HeadsUpOverride;
  onTimeTextChange: (value: string) => void;
  onInputModeChange: (value: CueInputMode) => void;
  onActionTypeChange: (value: CueActionType) => void;
  onTtsTextChange: (value: string) => void;
  onSoundIdChange: (value: SoundId) => void;
  onHeadsUpOverrideChange: (value: HeadsUpOverride) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  disableDuplicate?: boolean;
  disableDelete?: boolean;
  disabled?: boolean;
  timeErrorText?: string;
  timeHelperText?: string;
  ttsErrorText?: string;
  ttsHelperText?: string;
}

export default function CueRowEditor({
  cueLabel = 'Cue',
  timeText,
  inputMode,
  actionType,
  ttsText,
  soundId,
  headsUpOverride,
  onTimeTextChange,
  onInputModeChange,
  onActionTypeChange,
  onTtsTextChange,
  onSoundIdChange,
  onHeadsUpOverrideChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  disableMoveUp = false,
  disableMoveDown = false,
  disableDuplicate = false,
  disableDelete = false,
  disabled = false,
  timeErrorText,
  timeHelperText,
  ttsErrorText,
  ttsHelperText,
}: CueRowEditorProps) {
  const showsTtsField = actionType === 'tts' || actionType === 'combo';
  const showsSoundField = actionType === 'sound' || actionType === 'combo';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{cueLabel}</Text>
      <LabeledTextField
        label="Cue time"
        value={timeText}
        onChangeText={onTimeTextChange}
        placeholder="mm:ss or hh:mm:ss"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!disabled}
        errorText={timeErrorText}
        helperText={timeHelperText}
      />
      <SegmentedOptionSelector
        label="Entry mode"
        value={inputMode}
        options={INPUT_MODE_OPTIONS}
        onChange={onInputModeChange}
        disabled={disabled}
      />
      <ActionTypeSelector value={actionType} onChange={onActionTypeChange} disabled={disabled} />
      {showsTtsField ? (
        <LabeledTextField
          label="Cue text"
          value={ttsText}
          onChangeText={onTtsTextChange}
          placeholder="Speak this phrase at cue time"
          editable={!disabled}
          errorText={ttsErrorText}
          helperText={ttsHelperText}
        />
      ) : null}
      {showsSoundField ? (
        <SoundSelector
          value={soundId}
          onChange={onSoundIdChange}
          disabled={disabled}
          label={actionType === 'combo' ? 'Ping sound' : 'Sound'}
        />
      ) : null}
      <HeadsUpOverrideSelector
        value={headsUpOverride}
        onChange={onHeadsUpOverrideChange}
        disabled={disabled}
      />
      <CueRowActions
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        disableMoveUp={disableMoveUp}
        disableMoveDown={disableMoveDown}
        disableDuplicate={disableDuplicate}
        disableDelete={disableDelete}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
});
