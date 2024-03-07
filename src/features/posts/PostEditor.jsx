import { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import DateTimePicker from '@/components/DateTimePicker';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';

export default function PostEditor({ post, onChange }) {
  const [text, setText] = useState(post.text);
  const [assetRefs, setAssetRefs] = useState(post.assetRefs);
  const [postedAt, setPostedAt] = useState(post.postedAt);

  useEffect(() => {
    onChange({ text, assetRefs, postedAt });
  }, [text, assetRefs, postedAt]);

  return (
    <KeyboardAwareScrollView extraScrollHeight={40}>
      <PostAssetsEditor assetRefs={assetRefs} onChange={(assetRefs) => setAssetRefs(assetRefs)} />

      <View style={styles.container}>
        <TextInput
          style={styles.textArea}
          placeholder="What's new?"
          multiline
          numberOfLines={4}
          onChangeText={(text) => setText(text)}
          value={text}
        />

        <DateTimePicker timestamp={postedAt} onChange={(postedAt) => setPostedAt(postedAt)} style={{ marginTop: 10 }} />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },

  textArea: {
    fontSize: 16,
    lineHeight: 26,
    padding: 10,
    borderWidth: 1,
    borderColor: 'lightgray',
    borderRadius: 5,
    backgroundColor: 'white',
  },
});
