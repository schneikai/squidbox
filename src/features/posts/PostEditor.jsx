import { useState, useMemo, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Button } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import DateTimePicker from '@/components/DateTimePicker';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import useRandomSuggestions from '@/features/post-random-suggestions/useRandomSuggestions';
import usePosts from '@/features/posts-context/usePosts';
import { REFERENCE_POST_COUNT } from '@/features/ai-suggestions/sendAiMessageAsync';
export default function PostEditor({ post, onChange, navigation, onSave, canSave }) {
  const [text, setText] = useState(post.text);
  const [assetRefs, setAssetRefs] = useState(post.assetRefs);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);

  const { posts } = usePosts();

  const recentPostTexts = useMemo(
    () =>
      Object.values(posts ?? {})
        .filter((p) => p.text?.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, REFERENCE_POST_COUNT)
        .map((p) => p.text.trim()),
    [posts],
  );

  const { getNextTweet, getNextAsset, isLoading } = useRandomSuggestions({ recentPostTexts });
  const randomizeAssetRef = useRef(null);

  useEffect(() => {
    if (!navigation) return;
    navigation.setOptions({
      headerLeft: () => <Button onPress={() => navigation.goBack()} title="Cancel" />,
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleShuffleBoth}
            disabled={isLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="dice-outline" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
          <Button onPress={onSave} disabled={!canSave || isLoading} title="Save" />
        </View>
      ),
    });
  }, [navigation, canSave, isLoading, onSave]);

  function handleTextChange(newText) {
    setText(newText);
    onChange({ text: newText, assetRefs, postedAt });
  }

  function handleAssetRefsChange(newAssetRefs) {
    setAssetRefs(newAssetRefs);
    onChange({ text, assetRefs: newAssetRefs, postedAt });
  }

  function handlePostedAtChange(newPostedAt) {
    setPostedAt(newPostedAt);
    onChange({ text, assetRefs, postedAt: newPostedAt });
  }

  async function handleShuffleBoth() {
    try {
      const tweet = await getNextTweet();
      if (tweet) handleTextChange(tweet);
      randomizeAssetRef.current?.();
    } catch (e) {
      console.warn('Random suggestion failed:', e.message);
    }
  }

  async function handleRandomizeTweet() {
    try {
      const tweet = await getNextTweet();
      if (tweet) handleTextChange(tweet);
    } catch (e) {
      console.warn('Random tweet failed:', e.message);
    }
  }

  return (
    <>
      <ScrollView automaticallyAdjustKeyboardInsets>
        <PostAssetsEditor
          assetRefs={assetRefs}
          onChange={handleAssetRefsChange}
          getRandomAsset={getNextAsset}
          randomizeRef={randomizeAssetRef}
        />

        <View style={styles.container}>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textArea}
              placeholder="What's new?"
              multiline
              numberOfLines={4}
              onChangeText={handleTextChange}
              value={text}
            />
            <View style={styles.inputButtons}>
              <TouchableOpacity
                onPress={handleRandomizeTweet}
                disabled={isLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="dice-outline" size={22} color="#007AFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.wandButton}
                onPress={() => setShowAiChat(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="color-wand-outline" size={22} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          <DateTimePicker timestamp={postedAt} onChange={handlePostedAtChange} style={{ marginTop: 10 }} />
        </View>
      </ScrollView>

      <AiChatModal
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSelect={(suggestion) => handleTextChange(suggestion)}
        recentPostTexts={recentPostTexts}
        existingText={text}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },

  textInputWrapper: {
    position: 'relative',
  },

  textArea: {
    fontSize: 16,
    lineHeight: 26,
    padding: 10,
    paddingRight: 72,
    borderWidth: 1,
    borderColor: 'lightgray',
    borderRadius: 5,
    backgroundColor: 'white',
  },

  inputButtons: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    gap: 8,
  },

  wandButton: {},

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
