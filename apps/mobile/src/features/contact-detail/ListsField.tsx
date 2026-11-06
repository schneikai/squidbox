import IconRowsCard from './IconRowsCard';

import Button from '@/components/Button';

type ContactListName = { id: string; name: string };

/**
 * The lists a contact is in, as a card like its places (PlacesField): one row per list with × to
 * take the contact off it, "Add to list" at the card's end. `onOpen`, when given, opens a list
 * from its row.
 */
type ListsFieldProps = {
  lists: readonly ContactListName[];
  onRemove: (listId: string) => void;
  onAdd: () => void;
  onOpen?: (listId: string) => void;
};

export default function ListsField({ lists, onRemove, onAdd, onOpen }: ListsFieldProps) {
  return (
    <IconRowsCard
      icon="list"
      rows={lists.map((list) => ({
        key: list.id,
        title: list.name,
        onPress: onOpen && (() => onOpen(list.id)),
        accessibilityHint: onOpen ? 'Opens the list' : undefined,
        trailing: (
          <Button icon="close" onPress={() => onRemove(list.id)} accessibilityLabel={`Remove from ${list.name}`} />
        ),
      }))}
      addLabel="Add to list"
      onAdd={onAdd}
    />
  );
}
