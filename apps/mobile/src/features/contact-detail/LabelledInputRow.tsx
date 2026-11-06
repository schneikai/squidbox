import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import TextInput, { type TextInputProps } from '@/components/TextInput';
import { colors, layout, scale, sizes, space, textStyles } from '@/styles/designTokens';

// Wide enough for "OnlyFans" and "Country"; a larger text size widens it instead of clipping.
const LABEL_WIDTH = scale(84);
const GAP = space.md;

/** Where a row's text starts, from the card's left edge: what sits under the text lines up there. */
export const LABELLED_INPUT_TEXT_INSET = layout.rowInset + LABEL_WIDTH + GAP;

/**
 * A row of a card with its label on the left and its text on the right (HandleField,
 * SuggestionField), the label as wide in every row so the cards line up. `children` sit after the
 * text (marks, a button); `endsWithButton` gives a 44 pt button at the end its slot instead of the
 * right inset. The other props are TextInput's, with no corrections unless they say so.
 */
type LabelledInputRowProps = Omit<TextInputProps, 'style'> & {
  label: string;
  endsWithButton?: boolean;
  children?: ReactNode;
};

export default function LabelledInputRow({
  label,
  endsWithButton = false,
  children,
  ...inputProps
}: LabelledInputRowProps) {
  return (
    <View style={[styles.row, endsWithButton && styles.endsWithButton]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} autoCorrect={false} {...inputProps} style={styles.input} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    minHeight: scale(52),
    paddingHorizontal: layout.rowInset,
  },
  // The button's glyph ends rowInset from the edge, as a trailing icon's does.
  endsWithButton: {
    paddingRight: layout.rowInset - (sizes.iconButton - sizes.icon) / 2,
  },
  label: {
    minWidth: LABEL_WIDTH,
    ...textStyles.body,
    color: colors.text.primary,
  },
  input: {
    flex: 1,
    minWidth: 0, // a web input is as wide as its text box otherwise, which pushes the button out
    paddingVertical: space.lg,
  },
});
