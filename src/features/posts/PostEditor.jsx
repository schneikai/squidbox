import { useState, useMemo } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import DateTimePicker from '@/components/DateTimePicker';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import usePosts from '@/features/posts-context/usePosts';
import { REFERENCE_POST_COUNT } from '@/features/ai-suggestions/sendAiMessageAsync';

export default function PostEditor({ post, onChange }) {
  const [text, setText] = useState(post.text);
  const [assetRefs, setAssetRefs] = useState(post.assetRefs);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);

  const { posts } = usePosts();

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

  const recentPostTexts = useMemo(
    () =>
      Object.values(posts ?? {})
        .filter((p) => p.text?.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, REFERENCE_POST_COUNT)
        .map((p) => p.text.trim()),
    [posts],
  );

  return (
    <>
      <ScrollView automaticallyAdjustKeyboardInsets>
        <PostAssetsEditor assetRefs={assetRefs} onChange={handleAssetRefsChange} />

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
            <TouchableOpacity
              style={styles.wandButton}
              onPress={() => setShowAiChat(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="color-wand-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <DateTimePicker timestamp={postedAt} onChange={handlePostedAtChange} style={{ marginTop: 10 }} />
        </View>
      </ScrollView>

      <AiChatModal
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSelect={(suggestion) => setText(suggestion)}
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
    paddingRight: 40,
    borderWidth: 1,
    borderColor: 'lightgray',
    borderRadius: 5,
    backgroundColor: 'white',
  },

  wandButton: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
});
