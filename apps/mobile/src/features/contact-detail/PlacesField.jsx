import { CONTACT_LIMITS, formatPlace } from '@squidbox/shared';
import { Fragment } from 'react';

import SuggestionField from './SuggestionField';
import autofillPlace from './autofillPlace';
import { EMPTY_PLACE, storedPlace } from './contactFields';
import usePlaceSuggestions from './usePlaceSuggestions';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import AddRow from '@/components/settings-list/AddRow';
import confirmAsync from '@/utils/confirmAsync';

const PARTS = [
  { part: 'city', label: 'City', placeholder: 'City' },
  { part: 'state', label: 'State', placeholder: 'Optional' },
  { part: 'country', label: 'Country', placeholder: 'Country' },
];

/**
 * A contact's places as a card: each place its City, State and Country rows, offering what the
 * user's other contacts have (usePlaceSuggestions) and filling the empty parts a known city or state
 * implies, × on its first row to take it out (asking first
 * when it holds any text), and "Add place" at the card's end until it holds CONTACT_LIMITS.places.
 * `places` is the list as typed (`{ city, state, country }`, an empty one being added); every edit
 * hands the whole list to `onChange`.
 */
export default function PlacesField({ places, onChange, onBlur }) {
  const { suggestions, knownPlaces } = usePlaceSuggestions();

  // A city or state that names one known place fills the place's empty parts (autofillPlace).
  function setPart(index, part, text) {
    onChange(
      places.map((place, i) => (i === index ? autofillPlace({ ...place, [part]: text }, part, knownPlaces) : place)),
    );
  }

  async function handleRemove(index) {
    const place = storedPlace(places[index]);
    if (place) {
      const isConfirmed = await confirmAsync({
        title: `Remove ${formatPlace(place)}?`,
        action: 'Remove',
        destructive: true,
      });
      if (!isConfirmed) return;
    }
    onChange(places.filter((_, i) => i !== index));
  }

  return (
    <Card>
      {places.map((place, index) => (
        // The index is the place: a place has no id, and places only change at the end or by ×.
        // eslint-disable-next-line react/no-array-index-key
        <Fragment key={index}>
          {PARTS.map(({ part, label, placeholder }) => (
            <Fragment key={part}>
              <SuggestionField
                label={label}
                value={place[part]}
                onChangeText={(text) => setPart(index, part, text)}
                onBlur={onBlur}
                suggestions={suggestions[part]}
                placeholder={placeholder}
                maxLength={CONTACT_LIMITS.place}
                autoCapitalize="words"
                autoFocus={part === 'city' && !storedPlace(place) && index === places.length - 1}
                trailing={
                  part === 'city' && (
                    <Button icon="close" onPress={() => handleRemove(index)} accessibilityLabel="Remove place" />
                  )
                }
              />
              <Divider />
            </Fragment>
          ))}
        </Fragment>
      ))}
      {places.length < CONTACT_LIMITS.places && (
        <AddRow label="Add place" onPress={() => onChange([...places, EMPTY_PLACE])} />
      )}
    </Card>
  );
}
