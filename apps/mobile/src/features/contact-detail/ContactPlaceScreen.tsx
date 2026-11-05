import { CONTACT_LIMITS, type ContactPlace } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import PlaceEditor from './PlaceEditor';
import { storedPlace } from './contactFields';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import * as contacts from '@/sync/contactsRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

// A contact's place as a draft sheet (`?index=`, or none for a new one at the end), from the contact
// screen's Places. Save writes the contact's places as they are stored now, with this one changed.
export default function ContactPlaceScreen() {
  const { contactId, index: indexParam } = useLocalSearchParams<{ contactId: string; index?: string }>();
  const contact = useLiveRecord<schema.ContactRow>(schema.contacts, contactId);
  useCloseWhenGone(contact, 'This contact was deleted');
  const index = indexParam === undefined ? null : Number(indexParam);

  if (!contact) return null;

  const { id, places: storedPlaces } = contact;

  function write(places: (ContactPlace | string)[]) {
    return contacts.update(getDb(), id, {
      places: places
        .map(storedPlace)
        .filter((place): place is ContactPlace => place !== null)
        .slice(0, CONTACT_LIMITS.places),
    });
  }

  return (
    <PlaceEditor
      place={index === null ? null : storedPlaces[index]}
      onSave={(place) =>
        write(index === null ? [...storedPlaces, place] : storedPlaces.map((p, i) => (i === index ? place : p)))
      }
      onRemove={() => write(storedPlaces.filter((_, i) => i !== index))}
    />
  );
}
