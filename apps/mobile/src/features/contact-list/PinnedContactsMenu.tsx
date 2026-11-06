import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useContacts from '@/features/contacts-context/useContacts';
import type * as schema from '@/sync/db/schema';

/**
 * The pen on the pinned row's header (Contacts): picks what the row shows, Favorites or one of the
 * lists, with the one it shows now ticked.
 */
type PinnedContactsMenuProps = {
  lists: Pick<schema.ContactListRow, 'id' | 'name'>[];
  pinnedId: string | null;
};

export default function PinnedContactsMenu({ lists, pinnedId }: PinnedContactsMenuProps) {
  const { pinList } = useContacts();

  return (
    <MenuButton icon="edit" size="small" accessibilityLabel="Choose what to pin">
      <MenuOption label="Favorites" icon="heart" isSelected={pinnedId === null} onPress={() => pinList(null)} />
      {lists.map((list) => (
        <MenuOption
          key={list.id}
          label={list.name}
          icon="list"
          isSelected={list.id === pinnedId}
          onPress={() => pinList(list.id)}
        />
      ))}
    </MenuButton>
  );
}
