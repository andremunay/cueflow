import { StyleSheet, Text, View } from 'react-native';

export default function PlaybackScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playback</Text>
      <Text style={styles.subtitle}>Playback screen scaffold</Text>
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
