import { Text, Pressable, Alert } from "react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import buttonStyles from "styles/buttonStyles";
import { markPostDeleted, toPostData } from "services/PostDataService";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import { useNavigation } from "@react-navigation/native";

export default function PostActionSheet({ post }) {
  const navigation = useNavigation();
  const { showActionSheetWithOptions } = useActionSheet();

  function showActionSheet() {
    const options = ["Edit Post", "Delete Post", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            editPost();
            break;
          case 1:
            deletePost();
            break;
        }
      }
    );
  }

  async function editPost() {
    const [err, postData] = await to(toPostData(post));
    if (err) {
      handleError("Failed to load post data!", err);
      return;
    }
    navigation.navigate("NewPost", { post, postData });
  }

  async function deletePost() {
    const [err] = await to(markPostDeleted(post.id));
    if (err) {
      handleError("Failed to delete post!", err);
      return;
    }
    navigation.navigate("PostIndex");
  }

  return (
    <Pressable onPress={showActionSheet} style={buttonStyles.headerButton}>
      <Text style={buttonStyles.headerButtonText}>...</Text>
    </Pressable>
  );
}
