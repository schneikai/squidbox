import { useLocalSearchParams } from 'expo-router';

import useNewContactDraft from './useNewContactDraft';

import PlaceEditor from '@/features/contact-detail/PlaceEditor';
import { placeIndex, placesWith } from '@/features/contact-detail/contactFields';

// The New contact sheet's place step (`?index=`, or none for a new one), pushed inside the sheet:
// Add or Save puts the place in the draft, Remove place takes it out.
export default function NewContactPlaceScreen() {
  const { index: indexParam } = useLocalSearchParams<{ index?: string }>();
  const { draft, setField } = useNewContactDraft();
  const index = placeIndex(indexParam);

  return (
    <PlaceEditor
      place={index === null ? null : draft.places[index]}
      onSave={(place) => setField('places', placesWith(draft.places, index, place))}
      onRemove={() => setField('places', placesWith(draft.places, index, null))}
    />
  );
}
