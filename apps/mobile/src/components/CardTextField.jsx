import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import { scale } from '@/styles/designTokens';

// A Textarea in a form grows with its text up to this, then scrolls inside, so a long text never
// outgrows the screen and a drag on it scrolls the text, as a text view does on iOS.
const MAX_FORM_HEIGHT = scale(240);

/**
 * A text field on a Card, inset like a list row's text: one line, or a Textarea with `multiline`
 * (`minHeight` sets its height; it grows up to MAX_FORM_HEIGHT). `isFilling` makes the Textarea
 * fill the space its parent gives the card, scrolling its text inside, as in Notes (TextEditScreen).
 * Other props go to the input.
 *
 * A filling Textarea scrolls only once it has its size: iOS lays a long text out before the box's
 * final layout and would open it scrolled down a little.
 */
export default function CardTextField({ multiline = false, isFilling = false, ...rest }) {
  const [isLaidOut, setIsLaidOut] = useState(!isFilling);
  const Input = multiline ? Textarea : TextInput;
  return (
    <Card style={isFilling && styles.filling}>
      <Input
        style={[styles.input, multiline && (isFilling ? styles.filling : styles.capped)]}
        scrollEnabled={isLaidOut}
        onLayout={isLaidOut ? undefined : () => setIsLaidOut(true)}
        {...rest}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  capped: {
    maxHeight: MAX_FORM_HEIGHT,
  },
  filling: {
    flex: 1,
  },
});
