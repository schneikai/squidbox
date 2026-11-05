import { CONTACT_LIMITS, formatPlace } from '@squidbox/shared';
import { Fragment, useState } from 'react';

import SuggestionField from './SuggestionField';
import autofillPlace from './autofillPlace';
import { EMPTY_PLACE, storedPlace } from './contactFields';
import usePlaceSuggestions from './usePlaceSuggestions';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import EditSheet from '@/components/EditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import confirmAsync from '@/utils/confirmAsync';

const PARTS = [
  { part: 'city', label: 'City', placeholder: 'City' },
  { part: 'state', label: 'State', placeholder: 'Optional' },
  { part: 'country', label: 'Country', placeholder: 'Country' },
];

/**
 * One place of a contact as a draft sheet: New place (Add) without a `place`, else Edit place (Save),
 * both on once the place has a part set and, for Save, changed. Its City, State and Country offer
 * what the user's contacts have (usePlaceSuggestions), and a known city or state fills the empty
 * parts it implies (autofillPlace). `onSave(place)` gets it trimmed; Remove place, for one being
 * edited, asks first and calls `onRemove()`. Both write what the screen around it holds.
 */
export default function PlaceEditor({ place: seed, onSave, onRemove }) {
  const [initial] = useState(() => (seed ? storedPlace(seed) : null));
  const [draft, setDraft] = useState(() => ({ ...EMPTY_PLACE, ...initial }));
  const { suggestions, knownPlaces } = usePlaceSuggestions();
  const place = storedPlace(draft);
  const { sheetProps, finish } = useEditSheet({
    isNew: !initial,
    isValid: !!place,
    isDirty: JSON.stringify(place) !== JSON.stringify(initial),
    save: () => onSave(place),
    syncsItself: true,
  });

  function setPart(part, text) {
    setDraft((current) => autofillPlace({ ...current, [part]: text }, part, knownPlaces));
  }

  async function handleRemove() {
    const isConfirmed = await confirmAsync({
      title: `Remove ${formatPlace(initial)}?`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await finish(onRemove, "Couldn't remove the place");
  }

  return (
    <EditSheet
      {...sheetProps}
      title={initial ? 'Edit place' : 'New place'}
      actions={initial ? [{ label: 'Remove place', colorPalette: 'danger', onPress: handleRemove }] : []}
    >
      <Card>
        {PARTS.map(({ part, label, placeholder }, index) => (
          <Fragment key={part}>
            {index > 0 && <Divider />}
            <SuggestionField
              label={label}
              value={draft[part]}
              onChangeText={(text) => setPart(part, text)}
              suggestions={suggestions[part]}
              placeholder={placeholder}
              maxLength={CONTACT_LIMITS.place}
              autoCapitalize="words"
              autoFocus={!initial && part === 'city'}
            />
          </Fragment>
        ))}
      </Card>
    </EditSheet>
  );
}
