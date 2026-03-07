import LabeledTextField from './LabeledTextField';

export interface TagInputProps {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  editable?: boolean;
}

export default function TagInput({
  value,
  onChangeText,
  label = 'Tags',
  placeholder = 'warmup, focus, cooldown',
  helperText = 'Use commas to separate tags.',
  errorText,
  editable = true,
}: TagInputProps) {
  return (
    <LabeledTextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      helperText={helperText}
      errorText={errorText}
      editable={editable}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="done"
    />
  );
}
