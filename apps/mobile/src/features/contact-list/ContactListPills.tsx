import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, space, textStyles } from '@/styles/designTokens';

/** The lists a contact is in, each a small grey pill, wrapping onto more lines (a contact row's). */
type ContactListPillsProps = { names: string[] };

export default function ContactListPills({ names }: ContactListPillsProps) {
  return (
    <View style={styles.pills} accessibilityLabel={`Lists: ${names.join(', ')}`}>
      {names.map((name, index) => (
        <Text key={`${index}-${name}`} style={[textStyles.footnoteBold, styles.pill]} numberOfLines={1}>
          {name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.xs,
  },
  pill: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingHorizontal: layout.capsulePaddingX,
    paddingVertical: layout.capsulePaddingY,
    backgroundColor: colors.background.muted,
    color: colors.text.muted,
  },
});
