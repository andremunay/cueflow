import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LibraryScreen from '../screens/LibraryScreen';
import PlaybackScreen from '../screens/PlaybackScreen';
import PresetsComingSoonScreen from '../screens/PresetsComingSoonScreen';
import RoutineEditorScreen from '../screens/RoutineEditorScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Library">
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen
          name="RoutineEditor"
          component={RoutineEditorScreen}
          options={{ title: 'Routine Editor' }}
        />
        <Stack.Screen name="Playback" component={PlaybackScreen} />
        <Stack.Screen
          name="PresetsComingSoon"
          component={PresetsComingSoonScreen}
          options={{ title: 'Presets' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
