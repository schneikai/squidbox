import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import { layout } from '@/styles/designTokens';

/**
 * A screen's text actions, in order (`{ label, colorPalette, onPress, loading }`, e.g. Delete or Reset
 * changes; `loading` shows a spinner and blocks presses). Nothing without any. `isScreenEnd` is a
 * screen's actions at the end of its content, with the gap every screen has above them.
 */
export default function ActionButtons({ actions, isScreenEnd = false }) {
  if (actions.length === 0) return null;
  return (
    <View style={isScreenEnd && styles.screenEnd}>
      {actions.map((action) => (
        <Button
          key={action.label}
          label={action.label}
          colorPalette={action.colorPalette}
          onPress={action.onPress}
          loading={action.loading}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screenEnd: {
    paddingTop: layout.actionsGap,
  },
});
