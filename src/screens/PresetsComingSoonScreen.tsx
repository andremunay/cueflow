import { StyleSheet, Text, View } from 'react-native';

export default function PresetsComingSoonScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Presets coming soon</Text>
      <Text style={styles.subtitle}>Placeholder screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
  },
});
