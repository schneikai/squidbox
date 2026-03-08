import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { SCREEN_PADDING } from '@/constants';
import {
  DEFAULT_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_VARIATION_PROMPT,
  PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  VARIATION_PROMPT_STORAGE_KEY,
} from '@/features/ai-suggestions/aiSuggestionsStorage';

export default function AiPromptsScreen() {
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [variationPrompt, setVariationPrompt] = useState(DEFAULT_VARIATION_PROMPT);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  useEffect(() => {
    async function load() {
      try {
        const [p, v, s] = await Promise.all([
          AsyncStorage.getItem(PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(VARIATION_PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
        ]);
        if (p !== null) setDefaultPrompt(p);
        if (v !== null) setVariationPrompt(v);
        if (s !== null) setSystemPrompt(s);
      } catch {}
    }
    load();
  }, []);

  async function save(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  }

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content} extraScrollHeight={20}>
      <Text style={styles.sectionHeader}>Default Prompt</Text>
      <View style={styles.section}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>New post prompt</Text>
          <TextInput
            style={styles.cellInput}
            value={defaultPrompt}
            onChangeText={(v) => { setDefaultPrompt(v); save(PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. Create some caption ideas"
            placeholderTextColor="#C7C7CC"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Variation prompt</Text>
          <TextInput
            style={styles.cellInput}
            value={variationPrompt}
            onChangeText={(v) => { setVariationPrompt(v); save(VARIATION_PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. Create fresh variations of this post…"
            placeholderTextColor="#C7C7CC"
          />
        </View>
      </View>
      <Text style={styles.sectionFooter}>
        The variation prompt is used when you open the wand on a post that already has text.
      </Text>

      <Text style={styles.sectionHeader}>System Prompt</Text>
      <View style={styles.section}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Persona / instructions</Text>
          <TextInput
            style={styles.cellInput}
            value={systemPrompt}
            onChangeText={(v) => { setSystemPrompt(v); save(SYSTEM_PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. You are a creative writer for an OnlyFans account. Keep captions short and flirty."
            placeholderTextColor="#C7C7CC"
          />
        </View>
      </View>
      <Text style={styles.sectionFooter}>
        Prepended to every request before the style reference and format instructions. Leave blank to use no persona.
      </Text>

      <View style={styles.footer} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: SCREEN_PADDING,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6D6D72',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 8,
  },
  sectionFooter: {
    fontSize: 13,
    color: '#6D6D72',
    marginTop: 6,
    marginBottom: 12,
    marginHorizontal: 4,
    lineHeight: 18,
  },

  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 16,
  },

  cell: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
  },
  cellLabel: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  cellInput: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
    minHeight: 36,
  },

  footer: {
    height: 40,
  },
});
