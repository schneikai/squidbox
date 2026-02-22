import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';

import sendAiMessageAsync from './sendAiMessageAsync';
import {
  CHAT_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  VARIATION_PROMPT_STORAGE_KEY,
  DEFAULT_MODEL,
  DEFAULT_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_VARIATION_PROMPT,
} from './aiSuggestionsStorage';

// Models that are not useful for chat/text generation
const MODEL_ID_BLOCKLIST = ['whisper', 'tts', 'dall-e', 'davinci', 'babbage', 'curie', 'ada', 'embedding', 'moderation'];

export default function AiChatModal({ visible, onClose, onSelect, recentPostTexts, existingText }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [includeReference, setIncludeReference] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showReferencePosts, setShowReferencePosts] = useState(false);
  const flatListRef = useRef(null);
  const copiedKeyTimerRef = useRef(null);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (copiedKeyTimerRef.current) clearTimeout(copiedKeyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardHeightAnim]);

  async function loadSettings() {
    try {
      const [history, model, prompt, sysPrompt, variationPrompt] = await Promise.all([
        AsyncStorage.getItem(CHAT_STORAGE_KEY),
        AsyncStorage.getItem(MODEL_STORAGE_KEY),
        AsyncStorage.getItem(PROMPT_STORAGE_KEY),
        AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
        AsyncStorage.getItem(VARIATION_PROMPT_STORAGE_KEY),
      ]);

      const msgs = history ? JSON.parse(history) : [];
      const resolvedPrompt = prompt ?? DEFAULT_PROMPT;
      const resolvedVariationPrompt = variationPrompt ?? DEFAULT_VARIATION_PROMPT;
      const resolvedModel = model ?? DEFAULT_MODEL;
      const resolvedSystemPrompt = sysPrompt ?? DEFAULT_SYSTEM_PROMPT;

      setMessages(msgs);
      setDefaultPrompt(resolvedPrompt);
      setSystemPrompt(resolvedSystemPrompt);
      setSelectedModel(resolvedModel);

      if (msgs.length === 0) {
        if (existingText?.trim()) {
          setInputText(`${resolvedVariationPrompt}\n\n${existingText.trim()}`);
        } else {
          setInputText(resolvedPrompt);
        }
      }
    } catch {
      setMessages([]);
      setInputText(DEFAULT_PROMPT);
    }
  }

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

  async function handleOpenModelPicker() {
    setModelSearch('');
    setShowModelPicker(true);
    if (availableModels.length === 0) {
      await fetchAvailableModels();
    }
  }

  async function saveModel(modelId) {
    setSelectedModel(modelId);
    setShowModelPicker(false);
    try {
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, modelId);
    } catch {
      // non-critical
    }
  }

  async function saveHistory(msgs) {
    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
    } catch {
      // non-critical
    }
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    await sendMessage(text, messages);
  }

  async function sendMessage(userText, currentMessages) {
    const userMessage = { role: 'user', content: userText };
    const updatedMessages = [...currentMessages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const contextPosts = includeReference ? recentPostTexts : [];
      const suggestions = await sendAiMessageAsync(updatedMessages, contextPosts, selectedModel, systemPrompt);
      const assistantMessage = {
        role: 'assistant',
        content: JSON.stringify(suggestions),
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveHistory(finalMessages);
    } catch (error) {
      Alert.alert('Error', error.message);
      setMessages(currentMessages);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearChat() {
    Alert.alert('Clear Chat', 'Start a fresh conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
          setMessages([]);
          setInputText(defaultPrompt);
        },
      },
    ]);
  }

  async function handleCopy(text, key) {
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    if (copiedKeyTimerRef.current) clearTimeout(copiedKeyTimerRef.current);
    copiedKeyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleUse(text) {
    onSelect(text);
    onClose();
  }

  function scrollToEnd() {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function renderMessage({ item, index }) {
    if (item.role === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    let suggestions = [];
    try {
      suggestions = JSON.parse(item.content);
    } catch {
      suggestions = [item.content];
    }

    return (
      <View style={styles.assistantBubble}>
        {suggestions.map((suggestion, idx) => {
          const key = `${index}-${idx}`;
          const isLast = idx === suggestions.length - 1;
          return (
            <View key={key} style={[styles.suggestionRow, !isLast && styles.suggestionRowDivider]}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
              <View style={styles.suggestionActions}>
                <TouchableOpacity
                  onPress={() => handleCopy(suggestion, key)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={copiedKey === key ? 'checkmark-outline' : 'copy-outline'}
                    size={16}
                    color={copiedKey === key ? '#34C759' : '#999'}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.useButton} onPress={() => handleUse(suggestion)}>
                  <Text style={styles.useButtonText}>Use</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderLoadingBubble() {
    if (!isLoading) return null;
    return (
      <View style={styles.assistantContainer}>
        <View style={styles.loadingBubble}>
          <ActivityIndicator size="small" color="#888" />
          <Text style={styles.loadingText}>Generating captions…</Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Animated.View style={[styles.container, { paddingBottom: keyboardHeightAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modelSelector} onPress={handleOpenModelPicker}>
            <Text style={styles.modelSelectorText}>{selectedModel}</Text>
            <Ionicons name="chevron-down" size={14} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearChat} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, styles.clearButton]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Model picker overlay */}
        <Modal
          visible={showModelPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowModelPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowModelPicker(false)}
          >
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>Select Model</Text>

              {/* Search bar */}
              {!loadingModels && availableModels.length > 0 && (
                <View style={styles.pickerSearchRow}>
                  <Ionicons name="search-outline" size={16} color="#8E8E93" />
                  <TextInput
                    style={styles.pickerSearchInput}
                    value={modelSearch}
                    onChangeText={setModelSearch}
                    placeholder="Search"
                    placeholderTextColor="#C7C7CC"
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />
                </View>
              )}

              {loadingModels ? (
                <View style={styles.pickerLoading}>
                  <ActivityIndicator size="small" color="#888" />
                  <Text style={styles.pickerLoadingText}>Loading models…</Text>
                </View>
              ) : availableModels.length === 0 ? (
                <Text style={styles.pickerEmptyText}>No models found. Check your API key.</Text>
              ) : (
                <FlatList
                  data={availableModels.filter((id) =>
                    id.toLowerCase().includes(modelSearch.toLowerCase())
                  )}
                  keyExtractor={(id) => id}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={styles.pickerEmptyText}>No results for "{modelSearch}"</Text>
                  }
                  renderItem={({ item: modelId }) => (
                    <TouchableOpacity
                      style={[styles.pickerOption, selectedModel === modelId && styles.pickerOptionSelected]}
                      onPress={() => saveModel(modelId)}
                    >
                      <Text style={[styles.pickerOptionLabel, selectedModel === modelId && styles.pickerOptionLabelSelected]}>
                        {modelId}
                      </Text>
                      {selectedModel === modelId && (
                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Reference posts viewer */}
        <Modal
          visible={showReferencePosts}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReferencePosts(false)}
        >
          <View style={[styles.refModalContainer, { paddingBottom: insets.bottom }]}>
            <View style={styles.refModalHeader}>
              <Text style={styles.refModalTitle}>Style Reference</Text>
              <TouchableOpacity onPress={() => setShowReferencePosts(false)}>
                <Text style={styles.refModalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.refModalSubtitle}>
              Your {recentPostTexts.length} most recent posts will be used to match your tone.
            </Text>
            <FlatList
              data={recentPostTexts}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.refModalList}
              ItemSeparatorComponent={() => <View style={styles.refModalDivider} />}
              renderItem={({ item }) => (
                <View style={styles.refModalRow}>
                  <Text style={styles.refModalText}>{item}</Text>
                </View>
              )}
            />
          </View>
        </Modal>

        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          style={styles.messageListContainer}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={renderLoadingBubble}
          ListEmptyComponent={
            <Text style={styles.emptyHint}>Edit the prompt below and tap send to get caption ideas.</Text>
          }
        />

        {/* Reference toggle — only shown before the first message is sent, and only if there are posts */}
        {messages.length === 0 && recentPostTexts.length > 0 && (
          <View style={styles.referenceRow}>
            <TouchableOpacity onPress={() => setShowReferencePosts(true)} style={styles.referenceLabelButton}>
              <Text style={styles.referenceLabel}>
                Match my writing style
              </Text>
            </TouchableOpacity>
            <Switch
              value={includeReference}
              onValueChange={setIncludeReference}
              trackColor={{ false: '#ddd', true: '#007AFF' }}
              thumbColor="white"
              style={styles.referenceSwitch}
            />
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="e.g. create some kinky nsfw tweet ideas"
            placeholderTextColor="#aaa"
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modelSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  headerButton: {
    minWidth: 56,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  clearButton: {
    color: '#FF3B30',
    textAlign: 'right',
  },

  messageListContainer: {
    flex: 1,
  },
  messageList: {
    padding: 12,
    paddingBottom: 4,
    flexGrow: 1,
  },

  emptyHint: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },

  userBubbleContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 21,
  },

  assistantBubble: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },

  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  suggestionRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#111',
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  useButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  useButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    gap: 8,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },

  refModalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  refModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  refModalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  refModalClose: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  refModalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  refModalList: {
    padding: 16,
  },
  refModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  refModalDivider: {
    height: 6,
  },
  refModalText: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },

  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'white',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  referenceLabelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referenceLabel: {
    fontSize: 13,
    color: '#3C3C43',
  },
  referenceSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 16,
    backgroundColor: 'white',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#111',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerSheet: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    height: 440,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
  },
  pickerList: {
    flex: 1,
  },
  pickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  pickerLoadingText: {
    color: '#888',
    fontSize: 14,
  },
  pickerEmptyText: {
    color: '#aaa',
    fontSize: 14,
    padding: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerOptionSelected: {
    backgroundColor: '#f0f6ff',
  },
  pickerOptionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  pickerOptionLabelSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
});
