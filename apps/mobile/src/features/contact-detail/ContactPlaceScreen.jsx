import { CONTACT_LIMITS } from '@squidbox/shared';
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
  const { contactId, index: indexParam } = useLocalSearchParams();
  const contact = useLiveRecord(schema.contacts, contactId);
  useCloseWhenGone(contact, 'This contact was deleted');
  const index = indexParam === undefined ? null : Number(indexParam);

  if (!contact) return null;

  function write(places) {
    return contacts.update(getDb(), contact.id, {
      places: places.map(storedPlace).filter(Boolean).slice(0, CONTACT_LIMITS.places),
    });
  }

  return (
    <PlaceEditor
      place={index === null ? null : contact.places[index]}
      onSave={(place) =>
        write(index === null ? [...contact.places, place] : contact.places.map((p, i) => (i === index ? place : p)))
      }
      onRemove={() => write(contact.places.filter((_, i) => i !== index))}
    />
  );
}
