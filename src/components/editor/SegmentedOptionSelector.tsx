import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedOptionSelectorProps<T extends string> {
  label: string;
  value?: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function SegmentedOptionSelector<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedOptionSelectorProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = option.value === value;
          const isDisabled = disabled;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              disabled={isDisabled}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected,
                isDisabled && styles.optionButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                  isDisabled && styles.optionLabelDisabled,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#B8B8B8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  optionButtonSelected: {
    borderColor: '#2E5BFF',
    backgroundColor: '#E9EEFF',
  },
  optionButtonDisabled: {
    backgroundColor: '#F2F2F2',
    borderColor: '#D0D0D0',
  },
  optionLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: '#1B3CAA',
  },
  optionLabelDisabled: {
    color: '#787878',
  },
});
