import { View, Text, StyleSheet } from 'react-native';

export default function PostablePost({ post }) {
  return (
    <View>
      <Text>Post {post.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({});
