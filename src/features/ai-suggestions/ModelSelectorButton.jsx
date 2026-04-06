import AsyncStorage from '@react-native-async-storage/async-storage';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@/components/Icon';

import { DEFAULT_MODEL, MODEL_STORAGE_KEY } from './aiSuggestionsStorage';
import EmptyState from '@/components/EmptyState';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import SearchInput from '@/components/SearchInput';
import { colors, radii, scale, shadows, typography } from '@/styles/designTokens';

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
        <Icon name="chevron-down" size={scale(14)} color={colors.textSecondary} />
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
            <ModalHeader
              leftSlot={<ModalCloseButton onPress={() => setShowPicker(false)} />}
              centerSlot="Select Model"
            />
            <View style={styles.content}>
              {!loadingModels && availableModels.length > 0 && (
                <SearchInput
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              )}

              {loadingModels ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.loadingText}>Loading models…</Text>
                </View>
              ) : availableModels.length === 0 ? (
                <EmptyState
                  icon="alert"
                  title="No models found"
                  subtitle="Check your API key."
                  style={styles.emptyFull}
                />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(id) => id}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  ItemSeparatorComponent={() => <View style={styles.divider} />}
                  ListEmptyComponent={
                    <EmptyState
                      icon="search"
                      title={`No results for "${search}"`}
                      style={styles.emptyInList}
                    />
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
                        <Icon name="check" size={scale(18)} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
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
    ...shadows.floating,
  },
  content: {
    flex: 1,
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  list: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.base,
  },
  emptyFull: {
    flex: 1,
    paddingBottom: 40,
  },
  emptyInList: {
    paddingTop: 32,
    paddingBottom: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 14,
    borderRadius: 8,
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
