import { StyleSheet, View } from 'react-native';

import TextButton from '@/components/TextButton';

/**
 * A screen's text actions at the end of its content, in order (`{ label, tone, onPress, loading }`,
 * e.g. Delete or Reset to default; `loading` shows a spinner and blocks presses). Nothing without
 * any.
 */
export default function ActionButtons({ actions }) {
  if (actions.length === 0) return null;
  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <TextButton
          key={action.label}
          label={action.label}
          tone={action.tone}
          onPress={action.onPress}
          loading={action.loading}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: 24,
  },
});
