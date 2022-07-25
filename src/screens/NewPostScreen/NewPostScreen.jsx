import { useLayoutEffect } from "react";
import { Text, Pressable } from "react-native";
import buttonStyles from "styles/buttonStyles";
import NewPost from "components/NewPost";
import * as PostDataService from "services/PostDataService";
import { updateLastPostedAt } from "services/PostAssetDataService";
import to from "await-to-js";
import { handleError } from "services/ErrorHandling";

export default function NewPostScreen({
  navigation,
  route: { params: { post, postData = PostDataService.newPostData(), back } = {} },
}) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => {
        return (
          <>
            <Pressable onPress={cancel} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>Cancel</Text>
            </Pressable>
          </>
        );
      },
      headerRight: () => {
        return (
          <>
            <Pressable onPress={onSubmit} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>Post</Text>
            </Pressable>
          </>
        );
      },
    });
  }, [navigation]);

  function cancel() {
    navigation.goBack();
  }

  function onSubmit() {
    post ? updatePost() : createPost();
  }

  async function createPost() {
    const [err, post] = await to(PostDataService.createPost(postData));
    if (err) {
      handleError("Failed to add post!", err);
      return;
    }

    updateLastPostedAt(postData.postAssets, postData.postedAt);

    navigateAfterSubmit();
  }

  async function updatePost() {
    const [err] = await to(PostDataService.updatePost(post.id, postData));
    if (err) {
      handleError("Failed to rename album!", err);
      return;
    }

    navigateAfterSubmit();
  }

  function navigateAfterSubmit() {
    if (back === "PostIndex") {
      navigation.navigate("Main", {
        screen: "Posts",
        params: {
          screen: "PostIndex",
        },
      });
    } else {
      navigation.goBack();
    }
  }

  return <NewPost postData={postData} />;
}
