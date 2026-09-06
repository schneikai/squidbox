import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Textarea from '@/components/Textarea';
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

export default function AiPromptsScreen() {
  const navigation = useNavigation();
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
      <DetailScrollView>
        <ScreenSectionHeader title="Default Prompt" />
        <Card style={styles.card}>
          <Field label="New post prompt">
            <Textarea
              value={defaultPrompt}
              onChangeText={(v) => {
                setDefaultPrompt(v);
                save(PROMPT_STORAGE_KEY, v);
              }}
              placeholder="e.g. Create some caption ideas"
              minHeight={60}
            />
          </Field>
        </Card>
        <Card style={styles.card}>
          <Field
            label="Variation prompt"
            description="The variation prompt is used when you open the wand on a post that already has text."
          >
            <Textarea
              value={variationPrompt}
              onChangeText={(v) => {
                setVariationPrompt(v);
                save(VARIATION_PROMPT_STORAGE_KEY, v);
              }}
              placeholder="e.g. Create fresh variations of this post…"
              minHeight={60}
            />
          </Field>
        </Card>

        <ScreenSectionHeader title="Random Suggestions" />
        <Card style={styles.card}>
          <Field
            label="Random tweet prompt"
            description="Used by the dice button in Add Post. Describe the style and tone — the instruction to generate 10 tweets and return them as JSON is added automatically."
          >
            <Textarea
              value={randomTweetsPrompt}
              onChangeText={(v) => {
                setRandomTweetsPrompt(v);
                save(RANDOM_TWEETS_PROMPT_STORAGE_KEY, v);
              }}
              placeholder="e.g. Create tweets with variety…"
              minHeight={60}
            />
          </Field>
        </Card>

        <ScreenSectionHeader title="System Prompt" />
        <Card style={styles.card}>
          <Field
            label="Persona / instructions"
            description="Prepended to every request before the style reference and format instructions. Leave blank to use no persona."
          >
            <Textarea
              value={systemPrompt}
              onChangeText={(v) => {
                setSystemPrompt(v);
                save(SYSTEM_PROMPT_STORAGE_KEY, v);
              }}
              placeholder="e.g. You are a creative writer for an OnlyFans account. Keep captions short and flirty."
              minHeight={60}
            />
          </Field>
        </Card>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SCREEN_PADDING,
    marginBottom: 8,
  },
});
