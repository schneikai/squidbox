import { StyleSheet, View } from 'react-native';

import { colors, scale, space } from '@/styles/designTokens';

// The short line joining the posts of a thread, one card to the next (the post editor, the post screen).
export default function ThreadConnector() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    width: 2,
    height: scale(16),
    marginLeft: space.xxxl,
    backgroundColor: colors.accent.border,
  },
});
