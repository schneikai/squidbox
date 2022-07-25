import { useEffect, useState } from "react";
import { StyleSheet, TextInput, ScrollView } from "react-native";
import NewPostToolbar from "components/NewPost/NewPostToolbar";
import PostAssetList from "components/NewPost/PostAssetList";
import { newPostAsset, removeAssets } from "services/PostAssetDataService";
import useKeyboardHeight from "hooks/useKeyboardHeight";
import PostedAtControl from "components/NewPost/PostedAtControl";
import { fromTimestamp, toTimestamp } from "services/TimeService";

export default function NewPost({ postData }) {
  const [text, setText] = useState(postData.text);
  const [postAssets, setPostAssets] = useState(postData.postAssets);
  const [postedAt, setPostedAt] = useState(fromTimestamp(postData.postedAt));
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    Object.assign(postData, {
      text,
      postAssets: removeAssets(postAssets),
      postedAt: toTimestamp(postedAt || new Date()),
    });
  }, [text, postAssets, postedAt]);

  function addAssets(assets) {
    setPostAssets((postAssets) => [...postAssets, ...assets.map((asset) => newPostAsset(asset))]);
  }

  function removePostAsset(postAsset) {
    setPostAssets((postAssets) => postAssets.filter((x) => x.id !== postAsset.id));
  }

  // I'm using ScrollView as a container here so we can disable keyboard dismiss since we want to have it open
  // while creating the new post just like on twitter.
  return (
    <>
      <ScrollView keyboardShouldPersistTaps="always" style={styles.container}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setText(text)}
          value={text}
          autoFocus={true}
          multiline={true}
          placeholder="What`s new"
        />
        <PostAssetList postAssets={postAssets} removePostAsset={removePostAsset} style={styles.assetList} />
        <PostedAtControl postedAt={postedAt} setPostedAt={setPostedAt} />
      </ScrollView>
      <NewPostToolbar addAssets={addAssets} style={[styles.toolbar, { bottom: keyboardHeight }]} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  input: {
    fontSize: 18,
  },
  assetList: {
    marginTop: 20,
  },
  toolbar: {
    position: "absolute",
    zIndex: 1,
  },
});
