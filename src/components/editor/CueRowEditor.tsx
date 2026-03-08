import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CueActionType, HeadsUpOverride, SoundId } from '../../types';
import ActionTypeSelector from './ActionTypeSelector';
import CueRowActions from './CueRowActions';
import HeadsUpOverrideSelector from './HeadsUpOverrideSelector';
import LabeledTextField from './LabeledTextField';
import SoundSelector from './SoundSelector';

export interface CueRowEditorProps {
  cueLabel?: string;
  collapsedTimeLabel?: string;
  collapsed?: boolean;
  onToggleCollapsed: () => void;
  timeText: string;
  actionType: CueActionType;
  ttsText: string;
  soundId?: SoundId;
  headsUpOverride: HeadsUpOverride;
  headsUpLeadTimeText: string;
  onTimeTextChange: (value: string) => void;
  onActionTypeChange: (value: CueActionType) => void;
  onTtsTextChange: (value: string) => void;
  onSoundIdChange: (value: SoundId) => void;
  onHeadsUpOverrideChange: (value: HeadsUpOverride) => void;
  onHeadsUpLeadTimeTextChange: (value: string) => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  previewDisabled?: boolean;
  previewLoading?: boolean;
  disableDuplicate?: boolean;
  disableDelete?: boolean;
  disabled?: boolean;
  cueTimeAutoFocus?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  timeErrorText?: string;
  timeHelperText?: string;
  ttsErrorText?: string;
  ttsHelperText?: string;
  headsUpLeadTimeErrorText?: string;
  headsUpLeadTimeHelperText?: string;
}

export default function CueRowEditor({
  cueLabel = 'Cue',
  collapsedTimeLabel = '--:--',
  collapsed = false,
  onToggleCollapsed,
  timeText,
  actionType,
  ttsText,
  soundId,
  headsUpOverride,
  headsUpLeadTimeText,
  onTimeTextChange,
  onActionTypeChange,
  onTtsTextChange,
  onSoundIdChange,
  onHeadsUpOverrideChange,
  onHeadsUpLeadTimeTextChange,
  onPreview,
  onDuplicate,
  onDelete,
  previewDisabled = false,
  previewLoading = false,
  disableDuplicate = false,
  disableDelete = false,
  disabled = false,
  cueTimeAutoFocus = false,
  onLayout,
  timeErrorText,
  timeHelperText,
  ttsErrorText,
  ttsHelperText,
  headsUpLeadTimeErrorText,
  headsUpLeadTimeHelperText,
}: CueRowEditorProps) {
  const showsTtsField = actionType === 'tts' || actionType === 'combo';
  const showsSoundField = actionType === 'sound' || actionType === 'combo';
  const showsHeadsUpLeadTimeField = headsUpOverride === 'on';

  if (collapsed) {
    return (
      <Pressable
        accessibilityLabel={`${cueLabel}. Expand cue details.`}
        accessibilityRole="button"
        onPress={onToggleCollapsed}
        style={styles.collapsedContainer}
      >
        <View style={styles.collapsedHeader}>
          <Text style={styles.title}>{cueLabel}</Text>
          <Text style={styles.collapsedTimeLabel}>{collapsedTimeLabel}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Pressable
        accessibilityLabel={`${cueLabel}. Collapse cue details.`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onToggleCollapsed}
        style={[styles.headerPressable, disabled ? styles.headerPressableDisabled : undefined]}
      >
        <Text style={styles.title}>{cueLabel}</Text>
      </Pressable>
      <LabeledTextField
        label="Cue time"
        value={timeText}
        onChangeText={onTimeTextChange}
        placeholder="mm:ss or hh:mm:ss"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!disabled}
        autoFocus={cueTimeAutoFocus}
        errorText={timeErrorText}
        helperText={timeHelperText}
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
      <View style={styles.previewRow}>
        <Pressable
          accessibilityLabel="Preview cue"
          accessibilityRole="button"
          disabled={disabled || previewDisabled}
          onPress={onPreview}
          style={[
            styles.previewButton,
            disabled || previewDisabled ? styles.previewButtonDisabled : styles.previewButtonEnabled,
          ]}
        >
          <Text
            style={[
              styles.previewButtonLabel,
              disabled || previewDisabled
                ? styles.previewButtonLabelDisabled
                : styles.previewButtonLabelEnabled,
            ]}
          >
            {previewLoading ? 'Previewing...' : 'Preview'}
          </Text>
        </Pressable>
      </View>
      <HeadsUpOverrideSelector
        value={headsUpOverride}
        onChange={onHeadsUpOverrideChange}
        disabled={disabled}
      />
      {showsHeadsUpLeadTimeField ? (
        <LabeledTextField
          label="Heads-up lead time"
          value={headsUpLeadTimeText}
          onChangeText={onHeadsUpLeadTimeTextChange}
          placeholder="mm:ss or hh:mm:ss"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          editable={!disabled}
          errorText={headsUpLeadTimeErrorText}
          helperText={headsUpLeadTimeHelperText}
        />
      ) : null}
      <CueRowActions
        onDuplicate={onDuplicate}
        onDelete={onDelete}
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
  collapsedContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collapsedTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },
  headerPressable: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 2,
  },
  headerPressableDisabled: {
    opacity: 0.85,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  previewRow: {
    marginTop: 2,
    alignItems: 'flex-start',
  },
  previewButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewButtonEnabled: {
    borderColor: '#2E5BFF',
    backgroundColor: '#ECF1FF',
  },
  previewButtonDisabled: {
    borderColor: '#D5D5D5',
    backgroundColor: '#F3F3F3',
  },
  previewButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewButtonLabelEnabled: {
    color: '#1B3CAA',
  },
  previewButtonLabelDisabled: {
    color: '#838383',
  },
});
