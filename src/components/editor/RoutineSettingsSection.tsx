import { StyleSheet, Switch, Text, View } from 'react-native';

import LabeledTextField from './LabeledTextField';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  description?: string;
}

function ToggleRow({ label, value, onValueChange, disabled = false, description }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextGroup}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

export interface RoutineSettingsSectionProps {
  durationText: string;
  onDurationTextChange: (value: string) => void;
  defaultHeadsUpEnabled: boolean;
  onDefaultHeadsUpEnabledChange: (value: boolean) => void;
  hapticsEnabled: boolean;
  onHapticsEnabledChange: (value: boolean) => void;
  duckPlannedFlag: boolean;
  onDuckPlannedFlagChange: (value: boolean) => void;
  durationErrorText?: string;
  durationHelperText?: string;
  disabled?: boolean;
  title?: string;
}

export default function RoutineSettingsSection({
  durationText,
  onDurationTextChange,
  defaultHeadsUpEnabled,
  onDefaultHeadsUpEnabledChange,
  hapticsEnabled,
  onHapticsEnabledChange,
  duckPlannedFlag,
  onDuckPlannedFlagChange,
  durationErrorText,
  durationHelperText,
  disabled = false,
  title = 'Routine Settings',
}: RoutineSettingsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <LabeledTextField
        label="Routine duration"
        value={durationText}
        onChangeText={onDurationTextChange}
        placeholder="mm:ss or hh:mm:ss"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        errorText={durationErrorText}
        helperText={durationHelperText}
        editable={!disabled}
      />
      <View style={styles.toggleGroup}>
        <ToggleRow
          label="Default heads-up"
          value={defaultHeadsUpEnabled}
          onValueChange={onDefaultHeadsUpEnabledChange}
          disabled={disabled}
        />
        <ToggleRow
          label="Haptics at cue time"
          value={hapticsEnabled}
          onValueChange={onHapticsEnabledChange}
          disabled={disabled}
        />
        <ToggleRow
          label="Duck audio (planned/no-op)"
          value={duckPlannedFlag}
          onValueChange={onDuckPlannedFlagChange}
          disabled={disabled}
          description="Stored for future behavior. No runtime effect in MVP."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  toggleGroup: {
    marginTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
  },
  toggleDescription: {
    marginTop: 2,
    fontSize: 12,
    color: '#606060',
  },
});
