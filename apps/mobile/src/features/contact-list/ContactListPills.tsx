import { StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import { space } from '@/styles/designTokens';

/** The lists a contact is in, each a grey Badge, wrapping onto more lines (a contact row's). */
type ContactListPillsProps = { names: string[] };

export default function ContactListPills({ names }: ContactListPillsProps) {
  return (
    <View style={styles.pills} accessibilityLabel={`Lists: ${names.join(', ')}`}>
      {names.map((name, index) => (
        <Badge key={`${index}-${name}`} label={name} tone="neutral" numberOfLines={1} />
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
});
