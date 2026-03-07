import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export interface LabeledTextFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  helperText?: string;
  errorText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export default function LabeledTextField({
  label,
  value,
  onChangeText,
  helperText,
  errorText,
  containerStyle,
  inputStyle,
  editable = true,
  ...textInputProps
}: LabeledTextFieldProps) {
  const supportingText = errorText ?? helperText;
  const supportingTextStyle = errorText ? styles.errorText : styles.helperText;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        style={[styles.input, !editable && styles.inputDisabled, inputStyle]}
        placeholderTextColor="#747474"
        {...textInputProps}
      />
      {supportingText ? <Text style={[styles.supportingText, supportingTextStyle]}>{supportingText}</Text> : null}
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
  input: {
    borderWidth: 1,
    borderColor: '#B8B8B8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: '#F2F2F2',
    color: '#6F6F6F',
  },
  supportingText: {
    marginTop: 6,
    fontSize: 12,
  },
  helperText: {
    color: '#555555',
  },
  errorText: {
    color: '#B00020',
  },
});
