import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cue Builder</Text>
      <Text style={styles.subtitle}>Library screen scaffold</Text>
      <View style={styles.actions}>
        <Button
          title="Open Routine Editor"
          onPress={() => navigation.navigate('RoutineEditor')}
        />
      </View>
      <View style={styles.actions}>
        <Button title="Open Playback" onPress={() => navigation.navigate('Playback')} />
      </View>
      <View style={styles.actions}>
        <Button
          title="Open Presets Placeholder"
          onPress={() => navigation.navigate('PresetsComingSoon')}
        />
      </View>
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
  actions: {
    marginTop: 12,
    width: '100%',
  },
});
