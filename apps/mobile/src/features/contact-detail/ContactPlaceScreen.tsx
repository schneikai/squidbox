import { useLocalSearchParams } from 'expo-router';

import PlaceEditor from './PlaceEditor';
import { placeIndex } from './contactFields';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useContacts from '@/providers/contacts/useContacts';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

// A contact's place as a draft sheet (`?index=`, or none for a new one at the end), from the contact
// screen's Places. Save and Remove place change the place the sheet opened with in the contact's
// places as they are stored then (changePlace), so a change to them meanwhile is kept.
export default function ContactPlaceScreen() {
  const { contactId, index: indexParam } = useLocalSearchParams<{ contactId: string; index?: string }>();
  const contact = useLiveRecord(schema.contacts, contactId);
  const { changePlace } = useContacts();
  useCloseWhenGone(contact, 'This contact was deleted');
  const index = placeIndex(indexParam);

  if (!contact) return null;

  const { id, places } = contact;

  return (
    <PlaceEditor
      place={index === null ? null : places[index]}
      onSave={(place, from) => changePlace(id, from, place)}
      onRemove={(from) => changePlace(id, from, null)}
    />
  );
}
