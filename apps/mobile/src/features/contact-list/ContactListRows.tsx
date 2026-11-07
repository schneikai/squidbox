import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { builtInContactList } from './builtInContactLists';
import type { ContactListSummary } from './contactListQuery';

import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import ContactListMenu from '@/features/contact-list-detail/ContactListMenu';
import useHaptics from '@/hooks/useHaptics';
import { space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const OVERLAP = -space.xxl;

type ListSummary = Pick<ContactListSummary, 'id' | 'name' | 'memberCount' | 'firstMembers'>;

/**
 * The contact lists (contactListQuery's rows and the built-in ones) in one section: each list's name
 * and number of contacts, the avatars of its first members overlapping on the right, opening the
 * list. A long press on a list of the user's opens its menu (Edit list, Delete list), as its ⋯ does
 * on its screen; a built-in one has none, it can't be edited or deleted.
 */
type ContactListRowsProps = { lists: ListSummary[] };

export default function ContactListRows({ lists }: ContactListRowsProps) {
  const haptics = useHaptics();

  return (
    <Section>
      {lists.map((list) =>
        builtInContactList(list.id) ? (
          <ListRow key={list.id} list={list} />
        ) : (
          <ContactListMenu
            key={list.id}
            list={list}
            trigger={({ toggle }) => (
              <ListRow
                list={list}
                onLongPress={() => {
                  haptics.peek();
                  toggle();
                }}
              />
            )}
          />
        ),
      )}
    </Section>
  );
}

function ListRow({ list, onLongPress }: { list: ListSummary; onLongPress?: () => void }) {
  const members = list.firstMembers ?? [];
  return (
    <Row
      label={
        <View style={styles.labels}>
          <Text style={listTextStyles.name}>{list.name}</Text>
          <Text style={listTextStyles.detail}>{pluralizeText('1 contact', '%{count} contacts', list.memberCount)}</Text>
        </View>
      }
      onPress={() => router.navigate(`/contact-list/${list.id}`)}
      onLongPress={onLongPress}
      hasChevron
    >
      <View style={styles.stack}>
        {members.map((member, i) => (
          <ContactAvatar key={member.id} contact={member} size="row" isStacked style={i > 0 && styles.overlapped} />
        ))}
      </View>
    </Row>
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
});
