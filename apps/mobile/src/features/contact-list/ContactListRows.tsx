import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { builtInContactList } from './builtInContactLists';
import type { ContactListSummary } from './contactListQuery';

import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import ContactListMenu from '@/features/contact-list-detail/ContactListMenu';
import { colors, sizes, textStyles } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const DISC = sizes.avatar.compact;
// How much of each avatar shows behind the count, and so the stack's width, the same for every list
// so the names line up.
const PEEK = 12;
const STACK_WIDTH = DISC + 2 * PEEK;

/**
 * The contact lists (contactListQuery's rows and the built-in ones) in one section. Each row: its
 * number of contacts in a grey disc, its first members' avatars tucked behind it to the right, its
 * name, and, for a list of the user's, its ⋯ menu (a built-in one can't be edited or deleted); a tap
 * opens the list.
 */
type ContactListRowsProps = {
  lists: Pick<ContactListSummary, 'id' | 'name' | 'memberCount' | 'firstMembers'>[];
};

export default function ContactListRows({ lists }: ContactListRowsProps) {
  return (
    <Section>
      {lists.map((list) => (
        <Row
          key={list.id}
          label={<Text style={listTextStyles.name}>{list.name}</Text>}
          leading={<CountStack count={list.memberCount} members={list.firstMembers ?? []} />}
          onPress={() => router.navigate(`/contact-list/${list.id}`)}
        >
          {!builtInContactList(list.id) && <ContactListMenu list={list} />}
        </Row>
      ))}
    </Section>
  );
}

// The count in front, the members behind it, each further back.
function CountStack({ count, members }: { count: number; members: NonNullable<ContactListSummary['firstMembers']> }) {
  return (
    <View style={styles.stack} accessible accessibilityLabel={pluralizeText('1 contact', '%{count} contacts', count)}>
      <View style={styles.count}>
        <Text style={[textStyles.footnoteBold, styles.countText]}>{count.toLocaleString()}</Text>
      </View>
      {members.map((member, i) => (
        <ContactAvatar
          key={member.id}
          contact={member}
          size="compact"
          isStacked
          style={[styles.behind, { zIndex: members.length - i }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'row',
    width: STACK_WIDTH,
  },
  count: {
    zIndex: 3,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 2,
    borderColor: colors.background.surface,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: colors.text.muted,
  },
  behind: {
    marginLeft: PEEK - DISC,
  },
});
