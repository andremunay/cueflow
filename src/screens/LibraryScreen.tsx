import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { listRoutines } from '../services';
import type { Routine } from '../types';
import { filterRoutinesByQuery } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRoutines = useCallback(async (isActiveCheck?: () => boolean) => {
    const canUpdateState = isActiveCheck ?? (() => true);

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const loadedRoutines = await listRoutines();
      if (!canUpdateState()) {
        return;
      }

      setRoutines(loadedRoutines);
    } catch (error: unknown) {
      if (!canUpdateState()) {
        return;
      }

      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorMessage(`Could not load routines. ${error.message}`);
      } else {
        setErrorMessage('Could not load routines.');
      }
    } finally {
      if (canUpdateState()) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void loadRoutines(() => isActive);

      return () => {
        isActive = false;
      };
    }, [loadRoutines])
  );

  const filteredRoutines = useMemo(
    () => filterRoutinesByQuery(routines, searchQuery),
    [routines, searchQuery]
  );

  const showImportExportPlaceholder = useCallback((actionLabel: 'Import' | 'Export') => {
    Alert.alert(`${actionLabel} coming soon`, `${actionLabel} support is not implemented yet.`);
  }, []);

  const renderRoutine = useCallback(
    ({ item }: { item: Routine }) => (
      <View style={styles.routineCard}>
        <View style={styles.routineHeader}>
          <Text style={styles.routineName}>{item.name || 'Untitled routine'}</Text>
          <Text style={styles.routineFavorite}>{item.favorite ? '★' : '☆'}</Text>
        </View>
        <Text style={styles.routineTags}>
          {item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : 'Tags: none'}
        </Text>
      </View>
    ),
    []
  );

  const hasSavedRoutines = routines.length > 0;
  const hasFilteredResults = filteredRoutines.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cue Builder</Text>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search name or tags"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
      />
      <View style={styles.primaryActionsRow}>
        <View style={styles.primaryAction}>
          <Button title="New Routine" onPress={() => navigation.navigate('RoutineEditor')} />
        </View>
        <View style={styles.primaryAction}>
          <Button title="Import" onPress={() => showImportExportPlaceholder('Import')} />
        </View>
        <View style={styles.primaryAction}>
          <Button title="Export" onPress={() => showImportExportPlaceholder('Export')} />
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <Text style={styles.statusText}>Loading routines...</Text>
        ) : errorMessage ? (
          <View style={styles.statusGroup}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <View style={styles.statusAction}>
              <Button title="Retry" onPress={() => void loadRoutines()} />
            </View>
          </View>
        ) : !hasSavedRoutines ? (
          <View style={styles.emptyState}>
            <Text style={styles.subtitle}>No routines yet</Text>
            <View style={styles.emptyAction}>
              <Button
                title="Start with a preset"
                onPress={() => navigation.navigate('PresetsComingSoon')}
              />
            </View>
            <View style={styles.emptyAction}>
              <Button
                title="Create custom routine"
                onPress={() => navigation.navigate('RoutineEditor')}
              />
            </View>
          </View>
        ) : !hasFilteredResults ? (
          <Text style={styles.statusText}>No routines match your search.</Text>
        ) : (
          <FlatList
            data={filteredRoutines}
            keyExtractor={(routine) => routine.id}
            renderItem={renderRoutine}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#B8B8B8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  primaryActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  primaryAction: {
    flex: 1,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
    marginTop: 16,
  },
  statusText: {
    fontSize: 16,
    color: '#2B2B2B',
  },
  statusGroup: {
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 16,
    color: '#B00020',
  },
  statusAction: {
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'flex-start',
  },
  emptyAction: {
    marginTop: 12,
    width: '100%',
  },
  listContent: {
    paddingBottom: 20,
  },
  routineCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routineName: {
    flex: 1,
    marginRight: 10,
    fontSize: 17,
    fontWeight: '600',
    color: '#111111',
  },
  routineFavorite: {
    fontSize: 22,
    color: '#B8860B',
  },
  routineTags: {
    marginTop: 6,
    fontSize: 14,
    color: '#555555',
  },
});
