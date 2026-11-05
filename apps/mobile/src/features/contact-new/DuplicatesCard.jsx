import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, sizes, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

/**
 * "Already in your contacts": the contacts a new one may duplicate (findDuplicates), each with why
 * and Open, which hands the contact to `onOpen`.
 */
export default function DuplicatesCard({ matches, onOpen }) {
  return (
    <Card style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <Icon name="alert" size={sizes.iconSmall} color={colors.text.primary} />
        <Text style={styles.title}>Already in your contacts</Text>
      </View>
      {matches.map(({ contact, reason }, index) => (
        <View key={contact.id}>
          {index > 0 && <Divider />}
          <View style={styles.row}>
            <ContactAvatar contact={contact} size="small" />
            <View style={styles.labels}>
              <Text style={listTextStyles.title} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={listTextStyles.subtitle}>{reason}</Text>
            </View>
            <Button label="Open" size="small" onPress={() => onOpen(contact)} />
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.note,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: layout.sideGutter,
    paddingTop: 14,
    paddingBottom: 4,
  },
  title: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: layout.sideGutter,
    paddingVertical: 10,
  },
  labels: {
    flex: 1,
  },
});
