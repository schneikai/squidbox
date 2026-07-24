import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState, useTransition } from 'react';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import Reanimated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelSelectorButton from './ModelSelectorButton';
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
import sendAiMessageAsync from './sendAiMessageAsync';

import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import IconMenuButton from '@/components/IconMenuButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import Textarea from '@/components/Textarea';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { colors, radii, scale, spacing } from '@/styles/designTokens';

export default function AiChatModal({ visible, onClose, onSelect, recentPostTexts, existingText }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, startMessageTransition] = useTransition();
  const [copiedKey, setCopiedKey] = useState(null);
  const [includeReference, setIncludeReference] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [showReferencePosts, setShowReferencePosts] = useState(false);
  const flatListRef = useRef(null);
  const copiedKeyTimerRef = useRef(null);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const modelPickerRef = useRef(null);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

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
    return () => {
      show.remove();
      hide.remove();
    };
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

    startMessageTransition(async () => {
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
      }
    });
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
      const key = `user-${index}`;
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.content}</Text>
          </View>
          <IconButton
            icon={copiedKey === key ? 'check' : 'copy'}
            size={scale(15)}
            color={copiedKey === key ? '#34C759' : colors.textTertiary}
            onPress={() => handleCopy(item.content, key)}
            accessibilityLabel="Copy message"
            style={styles.userCopyButton}
          />
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
                <IconButton
                  icon={copiedKey === key ? 'check' : 'copy'}
                  size={scale(16)}
                  color={copiedKey === key ? '#34C759' : colors.textTertiary}
                  onPress={() => handleCopy(suggestion, key)}
                  accessibilityLabel="Copy message"
                />
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
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.loadingText}>Generating captions…</Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <MenuProvider skipInstanceCheck>
        <Animated.View style={[styles.container, { paddingBottom: keyboardHeightAnim }]}>
          <ModalHeader
            leftSlot={<ModalCloseButton onPress={onClose} />}
            centerSlot="AI Captions"
            scrollY={scrollY}
            rightSlot={
              <IconMenuButton accessibilityLabel="Chat options">
                <MenuOption label={selectedModel} icon="cpu" onPress={() => modelPickerRef.current?.open()} />
                <MenuOption label="Clear Chat" icon="trash" onPress={handleClearChat} isLast />
              </IconMenuButton>
            }
          />

          {/* Reference posts viewer */}
          <Modal
            visible={showReferencePosts}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowReferencePosts(false)}
          >
            <View style={[styles.refModalContainer, { paddingBottom: insets.bottom }]}>
              <ModalHeader
                leftSlot={<ModalCloseButton onPress={() => setShowReferencePosts(false)} />}
                centerSlot="Style Reference"
              />
              <Text style={styles.refModalSubtitle}>
                A random selection from your {recentPostTexts.length} past posts is used on each generation to match
                your tone and keep ideas fresh.
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
          <Reanimated.FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            style={styles.messageListContainer}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={scrollToEnd}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            ListFooterComponent={renderLoadingBubble}
            ListEmptyComponent={
              <Text style={styles.emptyHint}>Edit the prompt below and tap send to get caption ideas.</Text>
            }
          />

          {/* Reference toggle */}
          {messages.length === 0 && recentPostTexts.length > 0 && (
            <View style={styles.referenceRow}>
              <TouchableOpacity onPress={() => setShowReferencePosts(true)} style={styles.referenceLabelButton}>
                <Text style={styles.referenceLabel}>Match my writing style</Text>
              </TouchableOpacity>
              <Switch
                value={includeReference}
                onValueChange={setIncludeReference}
                trackColor={{ false: colors.glassBorder, true: colors.accent }}
                thumbColor={colors.textInverse}
                style={styles.referenceSwitch}
              />
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <Textarea
              style={styles.input}
              placeholder="e.g. create some caption ideas"
              value={inputText}
              onChangeText={setInputText}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Icon name="arrow-up" size={scale(20)} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
          {/* Hidden model picker */}
          <View style={styles.hidden}>
            <ModelSelectorButton ref={modelPickerRef} onChange={setSelectedModel} />
          </View>
        </Animated.View>
      </MenuProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },

  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },

  messageListContainer: {
    flex: 1,
  },
  messageList: {
    padding: 12,
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingBottom: 4,
    flexGrow: 1,
  },

  emptyHint: {
    color: colors.textTertiary,
    fontSize: scale(14),
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },

  userBubbleContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userCopyButton: {
    marginTop: 2,
    marginRight: 2,
  },
  userBubble: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: {
    color: colors.textInverse,
    fontSize: scale(15),
    lineHeight: 21,
  },

  assistantBubble: {
    backgroundColor: colors.glassSurface,
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
    borderBottomColor: colors.glassBorder,
  },
  suggestionText: {
    flex: 1,
    fontSize: scale(14),
    lineHeight: 20,
    color: colors.text,
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  useButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  useButtonText: {
    color: colors.textInverse,
    fontSize: scale(12),
    fontWeight: '600',
  },

  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassSurface,
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
    color: colors.textSecondary,
    fontSize: scale(14),
  },

  refModalContainer: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },
  refModalSubtitle: {
    fontSize: scale(13),
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: MODAL_HEADER_HEIGHT + 16,
    paddingBottom: 4,
  },
  refModalList: {
    padding: 16,
  },
  refModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    padding: 12,
    gap: 10,
  },
  refModalDivider: {
    height: 6,
  },
  refModalText: {
    flex: 1,
    fontSize: scale(15),
    color: colors.text,
    lineHeight: 22,
  },

  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.glassSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  referenceLabelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referenceLabel: {
    fontSize: scale(13),
    color: colors.text,
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
    backgroundColor: colors.glassSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.appBackground[0],
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: scale(15),
    color: colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
});
