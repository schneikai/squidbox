import { View, StyleSheet } from 'react-native';

import Button from '@/components/Button';
import Text from '@/components/Text';
import { lineHeights, sizes } from '@/styles/designTokens';

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
        <Text variant="label">{label}</Text>
        {onInfo && (
          <Button
            icon="info"
            size="small"
            onPress={onInfo}
            accessibilityLabel={`What goes in ${label}`}
            style={styles.info}
          />
        )}
        {rightSlot != null && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
      {children}
      {description != null && <Text variant="hint">{description}</Text>}
    </View>
  );
}

// A 44 pt button in the label row (the ⓘ, a rightSlot's) overlaps the space around the label instead
// of making its row taller.
const OVERLAP_LABEL_ROW = -(sizes.iconButton - lineHeights.footnote) / 2;

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    marginVertical: OVERLAP_LABEL_ROW,
    marginLeft: -6,
  },
  rightSlot: {
    marginLeft: 'auto',
    marginVertical: OVERLAP_LABEL_ROW,
  },
});
