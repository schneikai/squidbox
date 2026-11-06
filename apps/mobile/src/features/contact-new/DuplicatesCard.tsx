import { StyleSheet, Text, View } from 'react-native';

import type { DuplicateMatch } from './findDuplicates';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import DuplicateDot from '@/features/contact-detail/DuplicateDot';
import { colors, sizes, typography } from '@/styles/designTokens';

const PADDING_X = 14;
const GAP = 12;

/**
 * "Already in your contacts": the contacts a new one may duplicate (findDuplicates), each with why
 * and Open, which hands the contact to `onOpen`.
 */
type DuplicatesCardProps = { matches: DuplicateMatch[]; onOpen: (contact: DuplicateMatch['contact']) => void };

export default function DuplicatesCard({ matches, onOpen }: DuplicatesCardProps) {
  return (
    <Card style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <DuplicateDot />
        <Text style={styles.title}>Already in your contacts</Text>
      </View>
      {matches.map(({ contact, reason }, index) => (
        <View key={contact.id}>
          {index > 0 && <Divider style={styles.divider} />}
          <View style={[styles.row, index === matches.length - 1 && styles.lastRow]}>
            <ContactAvatar contact={contact} size="compact" />
            <View style={styles.labels}>
              <Text style={styles.name} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={styles.reason}>{reason}</Text>
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
    paddingHorizontal: PADDING_X,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: typography.detail,
    fontWeight: '600',
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: PADDING_X,
    paddingVertical: 8,
  },
  lastRow: {
    paddingBottom: 12,
  },
  divider: {
    marginLeft: PADDING_X + sizes.avatar.compact + GAP,
  },
  labels: {
    flex: 1,
  },
  name: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  reason: {
    marginTop: 1,
    fontSize: typography.footnote,
    color: colors.text.muted,
  },
});
