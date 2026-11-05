import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import Button from '@/components/Button';
import Text from '@/components/Text';
import { layout, lineHeights, space } from '@/styles/designTokens';

export type FieldProps = {
  label: string;
  description?: string;
  onInfo?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * A label + children slot + optional description text.
 * The unit of a labeled form entry.
 *
 * Does not include a card — callers compose Card + Field + TextInput themselves:
 *   <Card style={...}>
 *     <Field label="New post prompt" description="...">
 *       <TextInput multiline value={value} onChangeText={setValue} />
 *     </Field>
 *   </Card>
 *
 * `onInfo` ends the label with an ⓘ that calls it, to explain what goes in the field. `trailing`
 * sits at the label row's far end (a small button, say).
 *
 * style applies to the outer View.
 */
export default function Field({ label, description, onInfo, trailing, children, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <Text variant="label">{label}</Text>
        {onInfo && (
          <View style={[styles.slot, styles.info]}>
            <Button icon="info" size="small" onPress={onInfo} accessibilityLabel={`What goes in ${label}`} />
          </View>
        )}
        {trailing != null && <View style={[styles.slot, styles.trailing]}>{trailing}</View>}
      </View>
      {children}
      {description != null && <Text variant="hint">{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A button in the label row (the ⓘ, a trailing button), whatever its size, sits centered on the
  // label's line and overlaps the space around it instead of making the row taller.
  slot: {
    height: lineHeights.footnote,
    justifyContent: 'center',
  },
  info: {
    marginLeft: layout.iconGap,
  },
  trailing: {
    marginLeft: 'auto',
  },
});
