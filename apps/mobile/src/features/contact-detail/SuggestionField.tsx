import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import LabelledInputRow, { LABELLED_INPUT_TEXT_INSET } from './LabelledInputRow';
import shownSuggestions, { type Suggestion } from './shownSuggestions';

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
 * five, each with its `detail` in grey after it; a tap fills it with one, or calls `onPick` with it
 * when given. The other props are TextInput's.
 */
type SuggestionFieldProps<T extends Suggestion> = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: readonly T[];
  onPick?: (suggestion: T) => void;
};

export default function SuggestionField<T extends Suggestion>({
  label,
  value,
  onChangeText,
  onBlur,
  suggestions,
  onPick,
  ...inputProps
}: SuggestionFieldProps<T>) {
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
                key={`${suggestion.text}\n${suggestion.detail ?? ''}`}
                label={suggestion.text}
                detail={suggestion.detail}
                onPress={() => (onPick ? onPick(suggestion) : onChangeText(suggestion.text))}
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
