import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import LabelledInputRow, { LABELLED_INPUT_TEXT_INSET } from './LabelledInputRow';
import shownSuggestions, { type Suggestion } from './shownSuggestions';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import type { TextInputProps } from '@/components/TextInput';
import keepFocusOnPress from '@/lib/keepFocusOnPress';
import { layout, space } from '@/styles/designTokens';

const MAX_SHOWN = 5;

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
        <View style={styles.suggestions} {...keepFocusOnPress}>
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
