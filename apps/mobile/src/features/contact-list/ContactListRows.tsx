import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { ContactListSummary } from './contactListQuery';

import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, sizes, space, textStyles } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const STACK_SIZE = sizes.avatar.row;
const OVERLAP = -space.xxl;

/**
 * The contact lists (contactListQuery's rows, or the built-in ones) in one section: each list's name and count, the
 * avatars of its first members overlapping with "+N" for the rest, opening the list.
 */
type ContactListRowsProps = {
  lists: Pick<ContactListSummary, 'id' | 'name' | 'memberCount' | 'firstMembers'>[];
};

export default function ContactListRows({ lists }: ContactListRowsProps) {
  return (
    <Section>
      {lists.map(({ firstMembers = [], ...list }) => (
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
            {firstMembers.map((member, i) => (
              <ContactAvatar key={member.id} contact={member} size="row" isStacked style={i > 0 && styles.overlapped} />
            ))}
            {list.memberCount > firstMembers.length && <MoreDisc count={list.memberCount - firstMembers.length} />}
          </View>
        </Row>
      ))}
    </Section>
  );
}

// "+N", the members the stack leaves out.
function MoreDisc({ count }: { count: number }) {
  return (
    <View style={[styles.more, styles.overlapped]}>
      <Text style={[textStyles.footnoteBold, styles.moreText]}>+{count}</Text>
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
    color: colors.text.muted,
  },
});
