import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

import useScreenPadding from '@/hooks/useScreenPadding';

import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import {
  DEFAULT_PROMPT,
  DEFAULT_RANDOM_TWEETS_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_VARIATION_PROMPT,
  PROMPT_STORAGE_KEY,
  RANDOM_TWEETS_PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  VARIATION_PROMPT_STORAGE_KEY,
} from '@/features/ai-suggestions/aiSuggestionsStorage';
import { colors, glass, radii, typography } from '@/styles/designTokens';

export default function AiPromptsScreen() {
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [variationPrompt, setVariationPrompt] = useState(DEFAULT_VARIATION_PROMPT);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [randomTweetsPrompt, setRandomTweetsPrompt] = useState(DEFAULT_RANDOM_TWEETS_PROMPT);

  useEffect(() => {
    async function load() {
      try {
        const [p, v, s, r] = await Promise.all([
          AsyncStorage.getItem(PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(VARIATION_PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY),
        ]);
        if (p !== null) setDefaultPrompt(p);
        if (v !== null) setVariationPrompt(v);
        if (s !== null) setSystemPrompt(s);
        if (r !== null) setRandomTweetsPrompt(r);
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
    <Page>
      <FloatingDetailHeader title="AI Prompts" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]} automaticallyAdjustKeyboardInsets>
        <ScreenSectionHeader title="Default Prompt" />
        <View style={styles.card}>
          <Text style={styles.label}>New post prompt</Text>
          <TextInput
            style={styles.input}
            value={defaultPrompt}
            onChangeText={(v) => { setDefaultPrompt(v); save(PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. Create some caption ideas"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Variation prompt</Text>
          <TextInput
            style={styles.input}
            value={variationPrompt}
            onChangeText={(v) => { setVariationPrompt(v); save(VARIATION_PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. Create fresh variations of this post…"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <Text style={styles.footer}>
          The variation prompt is used when you open the wand on a post that already has text.
        </Text>

        <ScreenSectionHeader title="Random Suggestions" />
        <View style={styles.card}>
          <Text style={styles.label}>Random tweet prompt</Text>
          <TextInput
            style={styles.input}
            value={randomTweetsPrompt}
            onChangeText={(v) => { setRandomTweetsPrompt(v); save(RANDOM_TWEETS_PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. Create tweets with variety…"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <Text style={styles.footer}>
          Used by the dice button in Add Post. Describe the style and tone — the instruction to generate 10 tweets and return them as JSON is added automatically.
        </Text>

        <ScreenSectionHeader title="System Prompt" />
        <View style={styles.card}>
          <Text style={styles.label}>Persona / instructions</Text>
          <TextInput
            style={styles.input}
            value={systemPrompt}
            onChangeText={(v) => { setSystemPrompt(v); save(SYSTEM_PROMPT_STORAGE_KEY, v); }}
            multiline
            placeholder="e.g. You are a creative writer for an OnlyFans account. Keep captions short and flirty."
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <Text style={styles.footer}>
          Prepended to every request before the style reference and format instructions. Leave blank to use no persona.
        </Text>

      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },

  card: {
    ...glass,
    borderRadius: radii.card,
    padding: SCREEN_PADDING,
    marginBottom: 8,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    fontSize: typography.input,
    color: colors.text,
    lineHeight: 26,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  footer: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: 4,
    lineHeight: 20,
  },

});
