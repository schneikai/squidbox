import AsyncStorage from '@react-native-async-storage/async-storage';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DEFAULT_MODEL, MODEL_STORAGE_KEY } from './aiSuggestionsStorage';
import { colors, glass, radii, scale, shadows, typography } from '@/styles/designTokens';

const MODEL_ID_BLOCKLIST = [
  'whisper', 'tts', 'dall-e', 'davinci', 'babbage', 'curie', 'ada', 'embedding', 'moderation',
];

/**
 * Self-contained model selector. Renders a tappable trigger (model name + chevron)
 * intended for use in ModalHeader's centerSlot with centerStyle="pill".
 * Manages the picker modal internally and persists the selection to AsyncStorage.
 *
 * Props:
 *   onChange  (modelId: string) => void  — called when the user picks a new model
 */
const ModelSelectorButton = forwardRef(function ModelSelectorButton({ onChange }, ref) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(MODEL_STORAGE_KEY).then((m) => {
      if (m) setSelectedModel(m);
    });
  }, []);

  async function fetchAvailableModels() {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-...') return;
    setLoadingModels(true);
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      const models = (data.data ?? [])
        .map((m) => m.id)
        .filter((id) => !MODEL_ID_BLOCKLIST.some((blocked) => id.includes(blocked)))
        .sort();
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleOpen() {
    setSearch('');
    setShowPicker(true);
    if (availableModels.length === 0) {
      await fetchAvailableModels();
    }
  }

  useImperativeHandle(ref, () => ({ open: handleOpen }));

  async function handleSelect(modelId) {
    setSelectedModel(modelId);
    setShowPicker(false);
    try {
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, modelId);
    } catch {
      // non-critical
    }
    onChange?.(modelId);
  }

  const filtered = availableModels.filter((id) =>
    id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={handleOpen}>
        <Text style={styles.triggerText} numberOfLines={1}>{selectedModel}</Text>
        <Ionicons name="chevron-down" size={scale(14)} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Select Model</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={8}>
                <Ionicons name="close" size={scale(20)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!loadingModels && availableModels.length > 0 && (
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={scale(18)} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search"
                  placeholderTextColor={colors.textTertiary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />
              </View>
            )}

            {loadingModels ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.loadingText}>Loading models…</Text>
              </View>
            ) : availableModels.length === 0 ? (
              <Text style={styles.emptyText}>No models found. Check your API key.</Text>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(id) => id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={styles.divider} />}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No results for "{search}"</Text>
                }
                renderItem={({ item: modelId }) => (
                  <TouchableOpacity
                    style={[styles.option, selectedModel === modelId && styles.optionSelected]}
                    onPress={() => handleSelect(modelId)}
                  >
                    <Text style={[styles.optionLabel, selectedModel === modelId && styles.optionLabelSelected]}>
                      {modelId}
                    </Text>
                    {selectedModel === modelId && (
                      <Ionicons name="checkmark" size={scale(18)} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
});

export default ModelSelectorButton;

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 200,
  },
  triggerText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.appBackground[1],
    borderRadius: radii.modal,
    width: '100%',
    height: 440,
    overflow: 'hidden',
    padding: 20,
    gap: 20,
    ...shadows.floating,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  searchRow: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    padding: 12,
    gap: 8,
    marginHorizontal: -4,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.input,
    color: colors.text,
  },
  list: {
    flex: 1,
    marginTop: -14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.base,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: typography.base,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: colors.accentLight,
    padding: 14,
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
