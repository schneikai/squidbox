import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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

  useEffect(() => {
    onChange({ text, assetRefs, postedAt });
    // onChange is intentionally excluded: it's an inline callback that changes
    // reference every parent render, but re-running on every parent render would
    // cause an infinite loop. The effect only needs to fire when local values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, assetRefs, postedAt]);

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
      <KeyboardAwareScrollView extraScrollHeight={40}>
        <PostAssetsEditor assetRefs={assetRefs} onChange={(assetRefs) => setAssetRefs(assetRefs)} />

        <View style={styles.container}>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textArea}
              placeholder="What's new?"
              multiline
              numberOfLines={4}
              onChangeText={(text) => setText(text)}
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

          <DateTimePicker timestamp={postedAt} onChange={(postedAt) => setPostedAt(postedAt)} style={{ marginTop: 10 }} />
        </View>
      </KeyboardAwareScrollView>

      <AiChatModal
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSelect={(suggestion) => setText(suggestion)}
        recentPostTexts={recentPostTexts}
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
