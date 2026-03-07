import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import {
  createRoutineExportPayload,
  importRoutineFromJson,
  listRoutines,
  RoutineTransferError,
  toggleFavorite,
} from '../services';
import type { Routine } from '../types';
import { filterRoutinesByQuery } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
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

  const getTransferErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof RoutineTransferError) {
      switch (error.code) {
        case 'INVALID_JSON':
          return 'The selected file is not valid JSON.';
        case 'UNSUPPORTED_EXPORT_VERSION':
        case 'INVALID_EXPORT_STRUCTURE':
        case 'INVALID_ROUTINE_CONTENT':
          return 'The selected file is incompatible with Cue Builder import format.';
        case 'ROUTINE_VALIDATION_FAILED':
          return error.message;
        case 'DUPLICATE_ROUTINE_ID':
          return 'A routine with this id already exists.';
        case 'SHARING_UNAVAILABLE':
          return 'Sharing is unavailable on this device.';
        case 'FILE_READ_FAILED':
          return 'The selected file could not be read.';
        case 'FILE_WRITE_FAILED':
          return 'Could not write the export file.';
        default:
          break;
      }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'An unknown error occurred.';
  }, []);

  const closeExportModal = useCallback(() => {
    if (isExporting) {
      return;
    }

    setIsExportModalVisible(false);
  }, [isExporting]);

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

  const handleImportPress = useCallback(async () => {
    if (isImporting || isExporting) {
      return;
    }

    setIsImporting(true);

    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const selectedAsset = pickerResult.assets[0];
      let rawPayload: string;
      try {
        rawPayload = await FileSystem.readAsStringAsync(selectedAsset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch {
        throw new RoutineTransferError('FILE_READ_FAILED', 'Could not read the selected file.');
      }

      const imported = await importRoutineFromJson(rawPayload);
      await loadRoutines();

      const importedName = imported.routine.name || 'Untitled routine';
      const warningSuffix =
        imported.warnings.length > 0
          ? ` Imported with ${imported.warnings.length} warning${imported.warnings.length === 1 ? '' : 's'}.`
          : '';

      Alert.alert('Import complete', `Imported "${importedName}".${warningSuffix}`);
    } catch (error: unknown) {
      Alert.alert('Could not import routine', getTransferErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }, [getTransferErrorMessage, isExporting, isImporting, loadRoutines]);

  const openExportPicker = useCallback(() => {
    if (isImporting || isExporting) {
      return;
    }

    if (routines.length === 0) {
      Alert.alert('No routines to export', 'Create and save a routine before exporting.');
      return;
    }

    setIsExportModalVisible(true);
  }, [isExporting, isImporting, routines.length]);

  const handleExportRoutinePress = useCallback(
    async (routine: Routine) => {
      if (isExporting || isImporting) {
        return;
      }

      setIsExportModalVisible(false);
      setIsExporting(true);

      try {
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (!sharingAvailable) {
          throw new RoutineTransferError(
            'SHARING_UNAVAILABLE',
            'Sharing is unavailable on this device.'
          );
        }

        const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!baseDirectory) {
          throw new RoutineTransferError(
            'FILE_WRITE_FAILED',
            'No writable directory is available for export.'
          );
        }

        const safeName = (routine.name || routine.id || 'routine')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48);
        const exportFileName = `${safeName || 'routine'}-${Date.now()}.json`;
        const exportFileUri = `${baseDirectory}${exportFileName}`;
        const exportPayload = createRoutineExportPayload(routine);

        try {
          await FileSystem.writeAsStringAsync(exportFileUri, exportPayload, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        } catch {
          throw new RoutineTransferError('FILE_WRITE_FAILED', 'Could not write export payload.');
        }

        await Sharing.shareAsync(exportFileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export routine',
          UTI: 'public.json',
        });
      } catch (error: unknown) {
        Alert.alert('Could not export routine', getTransferErrorMessage(error));
      } finally {
        setIsExporting(false);
      }
    },
    [getTransferErrorMessage, isExporting, isImporting]
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
          <Button
            title={isImporting ? 'Importing...' : 'Import'}
            onPress={() => void handleImportPress()}
            disabled={isImporting || isExporting}
          />
        </View>
        <View style={styles.primaryAction}>
          <Button
            title={isExporting ? 'Exporting...' : 'Export'}
            onPress={openExportPicker}
            disabled={isImporting || isExporting}
          />
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

      <Modal
        visible={isExportModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeExportModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select routine to export</Text>
            <FlatList
              data={routines}
              keyExtractor={(routine) => routine.id}
              style={styles.exportList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    void handleExportRoutinePress(item);
                  }}
                  style={({ pressed }) => [
                    styles.exportRoutineRow,
                    pressed ? styles.exportRoutineRowPressed : undefined,
                  ]}
                >
                  <View style={styles.exportRoutineInfo}>
                    <Text style={styles.exportRoutineName}>{item.name || 'Untitled routine'}</Text>
                    <Text style={styles.exportRoutineTags}>
                      {item.tags.length > 0 ? item.tags.join(', ') : 'No tags'}
                    </Text>
                  </View>
                  <Text style={styles.exportRoutineAction}>Export</Text>
                </Pressable>
              )}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={closeExportModal} disabled={isExporting} />
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    maxHeight: '75%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 10,
  },
  exportList: {
    maxHeight: 320,
  },
  exportRoutineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E3E3E3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  exportRoutineRowPressed: {
    opacity: 0.8,
  },
  exportRoutineInfo: {
    flex: 1,
    paddingRight: 12,
  },
  exportRoutineName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#151515',
  },
  exportRoutineTags: {
    marginTop: 4,
    fontSize: 12,
    color: '#646464',
  },
  exportRoutineAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E5BFF',
  },
  modalActions: {
    marginTop: 6,
  },
});
