import { StyleSheet, Text as RNText, View } from 'react-native';

import type { DuplicateMatch } from './findDuplicates';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Text from '@/components/Text';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import DuplicateDot from '@/features/contact-detail/DuplicateDot';
import { colors, layout, sizes, space, textStyles } from '@/styles/designTokens';

const PADDING_X = layout.cardInset;
const GAP = layout.rowLeadingGap;

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
        <Text variant="title" size="small">
          Already in your contacts
        </Text>
      </View>
      {matches.map(({ contact, reason }, index) => (
        <View key={contact.id}>
          {index > 0 && <Divider style={styles.divider} />}
          <View style={[styles.row, index === matches.length - 1 && styles.lastRow]}>
            <ContactAvatar contact={contact} size="compact" />
            <View style={styles.labels}>
              <Text variant="title" size="small" numberOfLines={1}>
                {contact.name}
              </Text>
              <RNText style={styles.reason}>{reason}</RNText>
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
    gap: layout.iconGap,
    paddingHorizontal: PADDING_X,
    paddingTop: layout.rowPaddingYCompact,
    paddingBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: PADDING_X,
    paddingVertical: space.sm,
  },
  lastRow: {
    paddingBottom: layout.rowPaddingYCompact,
  },
  divider: {
    marginLeft: PADDING_X + sizes.avatar.compact + GAP,
  },
  labels: {
    flex: 1,
  },
  // `muted`, not a Text tone: secondary would fade on the note's yellow.
  reason: {
    marginTop: space.hair,
    ...textStyles.footnote,
    color: colors.text.muted,
  },
});
