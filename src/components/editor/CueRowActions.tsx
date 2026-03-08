import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
}

function ActionButton({ label, onPress, disabled, destructive = false }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        destructive && styles.destructiveButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          destructive && styles.destructiveButtonLabel,
          disabled && styles.disabledButtonLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface CueRowActionsProps {
  onDuplicate: () => void;
  onDelete: () => void;
  disableDuplicate?: boolean;
  disableDelete?: boolean;
  disabled?: boolean;
}

export default function CueRowActions({
  onDuplicate,
  onDelete,
  disableDuplicate = false,
  disableDelete = false,
  disabled = false,
}: CueRowActionsProps) {
  return (
    <View style={styles.container}>
      <ActionButton
        label="Duplicate"
        onPress={onDuplicate}
        disabled={disabled || disableDuplicate}
      />
      <ActionButton
        label="Delete"
        onPress={onDelete}
        disabled={disabled || disableDelete}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 4,
  },
  button: {
    borderWidth: 1,
    borderColor: '#A0A0A0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  destructiveButton: {
    borderColor: '#C62828',
    backgroundColor: '#FFEAEA',
  },
  disabledButton: {
    borderColor: '#D5D5D5',
    backgroundColor: '#F3F3F3',
  },
  buttonLabel: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  destructiveButtonLabel: {
    color: '#B00020',
  },
  disabledButtonLabel: {
    color: '#838383',
  },
});
