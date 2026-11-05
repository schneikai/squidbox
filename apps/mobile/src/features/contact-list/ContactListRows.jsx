import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, scale, sizes, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const STACK_SIZE = sizes.avatar.row;
const OVERLAP = -scale(12);

/**
 * The contact lists (contactListQuery's rows) in one section: each list's name and count, the
 * avatars of its first members overlapping with "+N" for the rest, opening the list.
 */
export default function ContactListRows({ lists }) {
  return (
    <Section>
      {lists.map((list) => (
        <Row
          key={list.id}
          label={
            <View style={styles.labels}>
              <Text style={listTextStyles.name}>{list.name}</Text>
              <Text style={listTextStyles.detail}>
                {pluralizeText('1 contact', '%{count} contacts', list.memberCount)}
              </Text>
            </View>
          }
          onPress={() => router.navigate(`/contact-list/${list.id}`)}
          hasChevron
        >
          <View style={styles.stack}>
            {list.firstMembers.map((member, i) => (
              <ContactAvatar key={member.id} contact={member} size="row" isStacked style={i > 0 && styles.overlapped} />
            ))}
            {list.memberCount > list.firstMembers.length && (
              <MoreDisc count={list.memberCount - list.firstMembers.length} />
            )}
          </View>
        </Row>
      ))}
    </Section>
  );
}

// "+N", the members the stack leaves out.
function MoreDisc({ count }) {
  return (
    <View style={[styles.more, styles.overlapped]}>
      <Text style={styles.moreText}>+{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flex: 1,
  },
  stack: {
    flexDirection: 'row',
  },
  overlapped: {
    marginLeft: OVERLAP,
  },
  more: {
    width: STACK_SIZE,
    height: STACK_SIZE,
    borderRadius: STACK_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background.surface,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: typography.footnote,
    fontWeight: '600',
    color: colors.text.muted,
  },
});
