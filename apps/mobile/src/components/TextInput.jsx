import { useState } from 'react';
import { TextInput as RNTextInput, StyleSheet } from 'react-native';

import Card from '@/components/Card';
import { SCREEN_PADDING } from '@/constants';
import { colors, scale, typography } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

// A multiline field grows with its text up to this, then scrolls inside, so a long text never
// outgrows the screen and a drag on it scrolls the text, as a text view does on iOS.
const MAX_FIELD_HEIGHT = scale(240);

/**
 * Every text input. `variant` is where it sits:
 *   inline — inside a layout of its own (the login form, the post editor, a tag row), the default.
 *            style is the input's own box: padding, flex, sizes
 *   field  — a field of its own on a Card, inset like a list row's text. A multiline one grows up
 *            to MAX_FIELD_HEIGHT; `isFilling` makes it fill the space its parent gives the card,
 *            scrolling its text inside, as in Notes (TextEditScreen). style is for layout only
 * `multiline` takes many lines at the reading line height (`minHeight` sets its height). The other
 * props are React Native's TextInput's.
 *
 * A filling field scrolls only once it has its size: iOS lays a long text out before the box's
 * final layout and would open it scrolled down a little.
 */
export default function TextInput({
  variant = 'inline',
  multiline = false,
  minHeight,
  isFilling = false,
  style,
  ...rest
}) {
  const [isLaidOut, setIsLaidOut] = useState(!isFilling);
  const textStyle = multiline ? textareaTextStyle : styles.line;

  if (variant === 'field') {
    return (
      <Card style={[isFilling && styles.filling, style]}>
        <RNTextInput
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : undefined}
          placeholderTextColor={colors.text.tertiary}
          style={[
            textStyle,
            styles.field,
            minHeight != null && { minHeight },
            multiline && (isFilling ? styles.filling : styles.capped),
          ]}
          scrollEnabled={isLaidOut}
          onLayout={isLaidOut ? undefined : () => setIsLaidOut(true)}
          {...rest}
        />
      </Card>
    );
  }

  return (
    <RNTextInput
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : undefined}
      placeholderTextColor={colors.text.tertiary}
      style={[textStyle, minHeight != null && { minHeight }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: typography.body,
    color: colors.text.primary,
  },
  field: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  capped: {
    maxHeight: MAX_FIELD_HEIGHT,
  },
  filling: {
    flex: 1,
  },
});
