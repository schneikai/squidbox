import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import LabelledInputRow, { LABELLED_INPUT_TEXT_INSET } from './LabelledInputRow';
import shownSuggestions from './shownSuggestions';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import type { TextInputProps } from '@/components/TextInput';
import { layout, space } from '@/styles/designTokens';

const MAX_SHOWN = 5;

// On the web a mousedown moves the focus, so a press on a chip would blur the field and take the
// chips away before its click lands: the chips' mousedown keeps the focus in the field instead.
// react-native-web passes onMouseDown to the DOM; React Native's types don't name it.
const KEEP_FOCUS_ON_PRESS: object =
  Platform.OS === 'web' ? { onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() } : {};

/**
 * A labelled text row of a card that offers what it may hold: while it has focus, the `suggestions`
 * that contain what is typed (as a search matches, shownSuggestions) show as chips under it, at most
 * five; a tap fills it with one. The other props are TextInput's.
 */
type SuggestionFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: readonly string[];
};

export default function SuggestionField({
  label,
  value,
  onChangeText,
  onBlur,
  suggestions,
  ...inputProps
}: SuggestionFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const shown = isFocused ? shownSuggestions(suggestions, value, MAX_SHOWN) : [];

  function handleBlur(event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) {
    setIsFocused(false);
    onBlur?.(event);
  }

  return (
    <View>
      <LabelledInputRow
        label={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        {...inputProps}
      />
      {shown.length > 0 && (
        <View style={styles.suggestions} {...KEEP_FOCUS_ON_PRESS}>
          <ChipRow>
            {shown.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                onPress={() => onChangeText(suggestion)}
                accessibilityHint={`Fills ${label} with it`}
              />
            ))}
          </ChipRow>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Under the text, where it starts.
  suggestions: {
    paddingLeft: LABELLED_INPUT_TEXT_INSET,
    paddingRight: layout.rowInset,
    paddingBottom: space.md,
  },
});
