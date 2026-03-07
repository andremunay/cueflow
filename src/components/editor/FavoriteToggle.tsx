import { StyleSheet, Switch, Text, View } from 'react-native';

export interface FavoriteToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function FavoriteToggle({
  value,
  onValueChange,
  label = 'Favorite',
  disabled = false,
}: FavoriteToggleProps) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.stateText}>{value ? 'Enabled' : 'Disabled'}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  stateText: {
    marginTop: 2,
    fontSize: 13,
    color: '#666666',
  },
});
