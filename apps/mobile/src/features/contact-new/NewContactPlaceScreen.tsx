import { useLocalSearchParams } from 'expo-router';

import useNewContactDraft from './useNewContactDraft';

import PlaceEditor from '@/features/contact-detail/PlaceEditor';

// The New contact sheet's place step (`?index=`, or none for a new one), pushed inside the sheet:
// Add or Save puts the place in the draft, Remove place takes it out.
export default function NewContactPlaceScreen() {
  const { index: indexParam } = useLocalSearchParams<{ index?: string }>();
  const { draft, setField } = useNewContactDraft();
  const index = indexParam === undefined ? null : Number(indexParam);

  return (
    <PlaceEditor
      place={index === null ? null : draft.places[index]}
      onSave={(place) =>
        setField(
          'places',
          index === null ? [...draft.places, place] : draft.places.map((p, i) => (i === index ? place : p)),
        )
      }
      onRemove={() =>
        setField(
          'places',
          draft.places.filter((_, i) => i !== index),
        )
      }
    />
  );
}
