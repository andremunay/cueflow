import { StyleSheet, Text, View } from 'react-native';

export default function RoutineEditorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Routine Editor</Text>
      <Text style={styles.subtitle}>Editor screen scaffold</Text>
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
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
  },
});
