import { CONTACT_LIMITS, type ContactPlace, formatPlace } from '@squidbox/shared';
import { Fragment, useState } from 'react';

import SuggestionField from './SuggestionField';
import autofillPlace from './autofillPlace';
import type { CitySuggestion } from './citySuggestions';
import { EMPTY_PLACE, storedPlace } from './contactFields';
import usePlaceSuggestions from './usePlaceSuggestions';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import EditSheet from '@/components/EditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import confirmAsync from '@/utils/confirmAsync';

const PARTS: { part: keyof ContactPlace; label: string; placeholder: string }[] = [
  { part: 'city', label: 'City', placeholder: 'City' },
  { part: 'state', label: 'State', placeholder: 'Optional' },
  { part: 'country', label: 'Country', placeholder: 'Country' },
];

/**
 * One place of a contact as a draft sheet: New location (Add) without a `place`, else Edit location (Save),
 * both on once the place has a part set and, for Save, changed. Its City, State and Country offer
 * what the user's contacts have (usePlaceSuggestions), and a known city or state fills the empty
 * parts it implies (autofillPlace); a city known in several places is offered once per place, and
 * picking one fills its state and country. `onSave(place, from)` gets it trimmed, with the place as the sheet
 * opened with it (null for a new one); Remove location, for one being edited, asks first and calls
 * `onRemove(from)`. Both write what the screen around it holds and ask for a sync if that needs one:
 * the sheet asks for none.
 */
type PlaceEditorProps = {
  place: ContactPlace | string | null | undefined;
  onSave: (place: ContactPlace, from: ContactPlace | null) => Promise<unknown> | void;
  onRemove: (from: ContactPlace) => Promise<unknown> | void;
};

export default function PlaceEditor({ place: seed, onSave, onRemove }: PlaceEditorProps) {
  const [initial] = useState(() => (seed ? storedPlace(seed) : null));
  const [draft, setDraft] = useState<ContactPlace>(() => ({ ...EMPTY_PLACE, ...initial }));
  const { cities, suggestions, knownPlaces } = usePlaceSuggestions();
  const place = storedPlace(draft);
  const { sheetProps, finish } = useEditSheet({
    isNew: !initial,
    isValid: !!place,
    isDirty: JSON.stringify(place) !== JSON.stringify(initial),
    save: async () => {
      if (place) await onSave(place, initial);
    },
    syncsItself: true,
  });

  function setPart(part: keyof ContactPlace, text: string) {
    setDraft((current) => autofillPlace({ ...current, [part]: text }, part, knownPlaces));
  }

  // A city picked as one of its places fills that place's state and country where they are empty.
  function pickCity({ text, place: picked }: CitySuggestion) {
    if (!picked) return setPart('city', text);
    setDraft((current) => ({
      city: text,
      state: current.state.trim() ? current.state : picked.state,
      country: current.country.trim() ? current.country : picked.country,
    }));
  }

  async function handleRemove() {
    if (!initial) return;
    const isConfirmed = await confirmAsync({
      title: `Remove ${formatPlace(initial)}?`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await finish(async () => onRemove(initial), "Couldn't remove the location");
  }

  return (
    <EditSheet
      {...sheetProps}
      title={initial ? 'Edit location' : 'New location'}
      actions={initial ? [{ label: 'Remove location', colorPalette: 'danger', onPress: handleRemove }] : []}
    >
      <Card>
        {PARTS.map(({ part, label, placeholder }, index) => (
          <Fragment key={part}>
            {index > 0 && <Divider />}
            {part === 'city' ? (
              <SuggestionField
                label={label}
                value={draft.city}
                onChangeText={(text) => setPart('city', text)}
                suggestions={cities}
                onPick={pickCity}
                placeholder={placeholder}
                maxLength={CONTACT_LIMITS.place}
                autoCapitalize="words"
                autoFocus={!initial}
              />
            ) : (
              <SuggestionField
                label={label}
                value={draft[part]}
                onChangeText={(text) => setPart(part, text)}
                suggestions={suggestions[part].map((text) => ({ text }))}
                placeholder={placeholder}
                maxLength={CONTACT_LIMITS.place}
                autoCapitalize="words"
              />
            )}
          </Fragment>
        ))}
      </Card>
    </EditSheet>
  );
}
