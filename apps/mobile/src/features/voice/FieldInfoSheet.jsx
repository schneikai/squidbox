import { StyleSheet, Text, View } from 'react-native';

import voiceFields from './voiceFields';

import BottomSheet from '@/components/BottomSheet';
import { colors, lineHeights, radii, typography } from '@/styles/designTokens';

// What goes in a field of Writing as you (`field`, a key of voiceFields): its description and three
// examples. `field` stays set while the sheet slides away after `isVisible` turned false.
export default function FieldInfoSheet({ field, isVisible, onClose }) {
  const { label, description, examples } = voiceFields[field];

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title={label}>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.heading}>For example</Text>
      <View style={styles.examples}>
        {examples.map((example) => (
          <View key={example} style={styles.example}>
            <Text style={styles.exampleText}>{example}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.secondary,
  },
  heading: {
    fontSize: typography.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  examples: {
    gap: 8,
  },
  example: {
    backgroundColor: colors.background.tint,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exampleText: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
});
