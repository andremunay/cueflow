import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { listRoutines, toggleFavorite } from '../services';
import type { Routine } from '../types';
import { filterRoutinesByQuery } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFavoriteById, setPendingFavoriteById] = useState<Record<string, true>>({});
  const pendingFavoriteIdsRef = useRef<Set<string>>(new Set());

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

  const markFavoritePending = useCallback((routineId: string): boolean => {
    if (pendingFavoriteIdsRef.current.has(routineId)) {
      return false;
    }

    pendingFavoriteIdsRef.current.add(routineId);
    setPendingFavoriteById((previousPending) => ({ ...previousPending, [routineId]: true }));
    return true;
  }, []);

  const clearFavoritePending = useCallback((routineId: string): void => {
    pendingFavoriteIdsRef.current.delete(routineId);
    setPendingFavoriteById((previousPending) => {
      if (!previousPending[routineId]) {
        return previousPending;
      }

      const nextPending = { ...previousPending };
      delete nextPending[routineId];
      return nextPending;
    });
  }, []);

  const openRoutineEditor = useCallback(
    (routineId: string) => {
      navigation.navigate('RoutineEditor', { routineId });
    },
    [navigation]
  );

  const openPlayback = useCallback(
    (routineId: string) => {
      navigation.navigate('Playback', { routineId });
    },
    [navigation]
  );

  const handleFavoritePress = useCallback(
    async (routineId: string) => {
      if (!markFavoritePending(routineId)) {
        return;
      }

      const routineBeforeToggle = routines.find((routine) => routine.id === routineId);
      if (!routineBeforeToggle) {
        clearFavoritePending(routineId);
        return;
      }

      setErrorMessage(null);
      setRoutines((previousRoutines) =>
        previousRoutines.map((routine) =>
          routine.id === routineId ? { ...routine, favorite: !routine.favorite } : routine
        )
      );

      try {
        const updatedRoutine = await toggleFavorite(routineId);
        setRoutines((previousRoutines) =>
          previousRoutines.map((routine) => (routine.id === routineId ? updatedRoutine : routine))
        );
      } catch (error: unknown) {
        setRoutines((previousRoutines) =>
          previousRoutines.map((routine) =>
            routine.id === routineId ? routineBeforeToggle : routine
          )
        );

        if (error instanceof Error && error.message.trim().length > 0) {
          Alert.alert('Could not update favorite', error.message);
        } else {
          Alert.alert('Could not update favorite', 'An unknown error occurred.');
        }
      } finally {
        clearFavoritePending(routineId);
      }
    },
    [clearFavoritePending, markFavoritePending, routines]
  );

  const renderRoutine = useCallback(
    ({ item }: { item: Routine }) => {
      const isFavoritePending = Boolean(pendingFavoriteById[item.id]);

      return (
        <Pressable
          onPress={() => openRoutineEditor(item.id)}
          style={({ pressed }) => [styles.routineCard, pressed ? styles.routineCardPressed : undefined]}
        >
          <View style={styles.routineHeader}>
            <Text style={styles.routineName}>{item.name || 'Untitled routine'}</Text>
            <Pressable
              accessibilityLabel={item.favorite ? 'Unfavorite routine' : 'Favorite routine'}
              accessibilityRole="button"
              disabled={isFavoritePending}
              onPress={(event) => {
                event.stopPropagation();
                void handleFavoritePress(item.id);
              }}
              style={({ pressed }) => [
                styles.favoriteButton,
                pressed || isFavoritePending ? styles.favoriteButtonPressed : undefined,
              ]}
            >
              <Text
                style={[
                  styles.routineFavorite,
                  isFavoritePending ? styles.routineFavoritePending : undefined,
                ]}
              >
                {item.favorite ? '\u2605' : '\u2606'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.routineTags}>
            {item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : 'Tags: none'}
          </Text>
          <View style={styles.routineActionsRow}>
            <Pressable
              accessibilityLabel="Play routine"
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                openPlayback(item.id);
              }}
              style={({ pressed }) => [
                styles.playButton,
                pressed ? styles.playButtonPressed : undefined,
              ]}
            >
              <Text style={styles.playButtonLabel}>Play</Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [handleFavoritePress, openPlayback, openRoutineEditor, pendingFavoriteById]
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
  routineCardPressed: {
    opacity: 0.92,
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
  routineFavoritePending: {
    color: '#9B9B9B',
  },
  favoriteButton: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  favoriteButtonPressed: {
    opacity: 0.6,
  },
  routineTags: {
    marginTop: 6,
    fontSize: 14,
    color: '#555555',
  },
  routineActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  playButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#2E5BFF',
  },
  playButtonPressed: {
    opacity: 0.8,
  },
  playButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
