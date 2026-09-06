import { View, Text, StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

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
 * style applies to the outer View.
 */
export default function Field({ label, description, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {description != null && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  description: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
