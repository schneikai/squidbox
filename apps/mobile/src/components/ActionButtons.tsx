import { StyleSheet, View } from 'react-native';

import Button, { type ButtonProps } from '@/components/Button';
import { layout } from '@/styles/designTokens';

export type ActionButtonAction = Pick<ButtonProps, 'colorPalette' | 'onPress' | 'loading' | 'disabled'> & {
  label: string;
};

export type ActionButtonsProps = { actions: ActionButtonAction[]; isScreenEnd?: boolean };

/**
 * A screen's text actions, in order (`{ label, colorPalette, onPress, loading, disabled }`, e.g. Delete
 * or Reset changes; `loading` shows a spinner and blocks presses, `disabled` greys it out). Nothing without any. `isScreenEnd` is a
 * screen's actions at the end of its content, with the gap every screen has above them.
 */
export default function ActionButtons({ actions, isScreenEnd = false }: ActionButtonsProps) {
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
          disabled={action.disabled}
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
