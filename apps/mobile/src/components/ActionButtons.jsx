import { View } from 'react-native';

import TextButton from '@/components/TextButton';

/**
 * A screen's text actions at the end of its content, in order (`{ label, tone, onPress, loading }`,
 * e.g. Delete or Reset changes; `loading` shows a spinner and blocks presses). Nothing without
 * any. The parent spaces it through `style`.
 */
export default function ActionButtons({ actions, style }) {
  if (actions.length === 0) return null;
  return (
    <View style={style}>
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
