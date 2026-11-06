import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import IconSlotContext from '@/components/IconSlotContext';
import AddRow from '@/components/settings-list/AddRow';
import { colors, layout, press, scale, sizes, typography } from '@/styles/designTokens';

const ICON_GAP = 12;

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
    <Card>
      {lists.map((list, index) => (
        <View key={list.id}>
          <Pressable
            onPress={onOpen && (() => onOpen(list.id))}
            disabled={!onOpen}
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityHint={onOpen ? 'Opens the list' : undefined}
            style={({ pressed }) => [styles.row, pressed && press.flat]}
          >
            <Icon name="list" size={sizes.icon} color={colors.text.secondary} />
            <Text style={styles.title} numberOfLines={1}>
              {list.name}
            </Text>
            <IconSlotContext.Provider value>
              <Button icon="close" onPress={() => onRemove(list.id)} accessibilityLabel={`Remove from ${list.name}`} />
            </IconSlotContext.Provider>
          </Pressable>
          <Divider style={index === lists.length - 1 ? undefined : styles.divider} />
        </View>
      ))}
      <AddRow label="Add to list" onPress={onAdd} />
    </Card>
  );
}

const styles = StyleSheet.create({
  // The × sits in a 44 pt slot, so the row's right inset is smaller than its left.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ICON_GAP,
    minHeight: scale(52),
    paddingLeft: layout.sideGutter,
    paddingRight: 4,
  },
  title: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  // Between lists, the line starts at the text.
  divider: {
    marginLeft: layout.sideGutter + sizes.icon + ICON_GAP,
  },
});
