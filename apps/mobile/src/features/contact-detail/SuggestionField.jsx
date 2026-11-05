import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import IconSlotContext from '@/components/IconSlotContext';
import TextInput from '@/components/TextInput';
import { colors, layout, scale, typography } from '@/styles/designTokens';

// Wide enough for "Country"; the same as a handle's label (HandleField), so the cards line up.
const LABEL_WIDTH = scale(84);
const GAP = 12;
const MAX_SHOWN = 5;

/**
 * A labelled text row of a card that offers what it may hold: while it has focus, the `suggestions`
 * that contain what is typed (ignoring case, not the text itself) show as chips under it, at most
 * five; a tap fills it with one. `trailing` ends the row (a ×). The other props are TextInput's.
 */
export default function SuggestionField({ label, value, onChangeText, onBlur, suggestions, trailing, ...inputProps }) {
  const [isFocused, setIsFocused] = useState(false);
  const typed = value.trim().toLowerCase();
  const shown = isFocused
    ? suggestions
        .filter((suggestion) => {
          const text = suggestion.toLowerCase();
          return text !== typed && text.includes(typed);
        })
        .slice(0, MAX_SHOWN)
    : [];

  function handleBlur(event) {
    setIsFocused(false);
    onBlur?.(event);
  }

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          accessibilityLabel={label}
          autoCorrect={false}
          style={styles.input}
          {...inputProps}
        />
        {/* A full 44 pt slot, so its icon sits in from the card's edge. */}
        <IconSlotContext.Provider value>{trailing}</IconSlotContext.Provider>
      </View>
      {shown.length > 0 && (
        <View style={styles.suggestions}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    minHeight: scale(52),
    paddingLeft: layout.sideGutter,
    paddingRight: 4,
  },
  label: {
    minWidth: LABEL_WIDTH,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
  },
  // Under the text, where it starts.
  suggestions: {
    paddingLeft: layout.sideGutter + LABEL_WIDTH + GAP,
    paddingRight: layout.sideGutter,
    paddingBottom: 12,
  },
});
