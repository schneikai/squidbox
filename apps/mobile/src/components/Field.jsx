import { View, Text, StyleSheet } from 'react-native';

import IconButton from '@/components/IconButton';
import { colors, lineHeights, sizes, typography } from '@/styles/designTokens';

/**
 * A label + children slot + optional description text.
 * The unit of a labeled form entry.
 *
 * Does not include a card — callers compose Card + Field + Textarea themselves:
 *   <Card style={...}>
 *     <Field label="New post prompt" description="...">
 *       <Textarea value={value} onChangeText={setValue} />
 *     </Field>
 *   </Card>
 *
 * `onInfo` ends the label with an ⓘ that calls it, to explain what goes in the field. `rightSlot`
 * sits at the label row's far end (a small button, say).
 *
 * style applies to the outer View.
 */
export default function Field({ label, description, onInfo, rightSlot, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onInfo && (
          <IconButton
            icon="info"
            size={sizes.iconSmall}
            color={colors.text.tertiary}
            onPress={onInfo}
            accessibilityLabel={`What goes in ${label}`}
            style={styles.info}
          />
        )}
        {rightSlot != null && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
      {children}
      {description != null && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The 44 pt tap target overlaps the space around the label instead of making its row taller.
  info: {
    marginVertical: -(sizes.iconButton - lineHeights.footnote) / 2,
    marginLeft: -6,
  },
  // A slot's 44 pt button overlaps the space around the label, as the ⓘ does.
  rightSlot: {
    marginLeft: 'auto',
    marginVertical: -(sizes.iconButton - lineHeights.footnote) / 2,
  },
  label: {
    fontSize: typography.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  description: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
    lineHeight: lineHeights.footnote,
  },
});
