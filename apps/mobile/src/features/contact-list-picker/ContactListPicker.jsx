import { Text } from 'react-native';

import SelectIndicator from '@/components/SelectIndicator';
import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';
import contactListQuery from '@/features/contact-list/contactListQuery';
import useAddListAction from '@/features/contact-list/useAddListAction';
import listTextStyles from '@/styles/listTextStyles';
import { useLiveQuery } from '@/sync/useLiveQuery';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

/**
 * The contact lists to pick from, by name, each with a selection circle, and "New list" at the end
 * (a new list is picked too). `selectedIds` are the picked lists' ids; `onChange` gets the new ones.
 */
export default function ContactListPicker({ selectedIds, onChange }) {
  const query = contactListQuery();
  const lists = useLiveQuery((db) => query.read(db), query.tables, [query.descriptor]);
  const promptAddList = useAddListAction({ onAdded: (list) => onChange([...selectedIds, list.id]) });

  if (!lists) return null;

  return (
    <Section isHeaderless>
      {lists.map((list) => (
        <Row
          key={list.id}
          label={list.name}
          leading={<SelectIndicator isSelected={selectedIds.includes(list.id)} />}
          onPress={() => onChange(toggleItem(selectedIds, list.id))}
        >
          <Text style={listTextStyles.subtitle}>
            {pluralizeText('1 contact', '%{count} contacts', list.memberCount)}
          </Text>
        </Row>
      ))}
      <AddRow label="New list" onPress={promptAddList} />
    </Section>
  );
}
