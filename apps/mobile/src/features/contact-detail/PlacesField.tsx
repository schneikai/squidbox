import { CONTACT_LIMITS, type ContactPlace, formatPlace, placeParts } from '@squidbox/shared';

import IconRowsCard from './IconRowsCard';

/**
 * A contact's places as a card: each place one row, its city over "State, Country" (what it has
 * when it has no city), opening it with `onEdit(index)`; "Add place" at the card's end calls
 * `onAdd()` until it holds CONTACT_LIMITS.places. The places are edited in a sheet (PlaceEditor).
 */
type PlacesFieldProps = {
  places: readonly (ContactPlace | string)[];
  onEdit: (index: number) => void;
  onAdd: () => void;
};

export default function PlacesField({ places, onEdit, onAdd }: PlacesFieldProps) {
  return (
    <IconRowsCard
      icon="map-pin"
      twoLine
      rows={places.map((stored, index) => {
        const place = placeParts(stored);
        return {
          // The index is the place: a place has no id.
          key: String(index),
          title: place.city || formatPlace(place),
          detail: place.city ? [place.state, place.country].filter(Boolean).join(', ') : '',
          onPress: () => onEdit(index),
          accessibilityLabel: formatPlace(place),
          accessibilityHint: 'Edits the place',
          trailing: 'chevron',
        };
      })}
      addLabel={places.length < CONTACT_LIMITS.places ? 'Add place' : undefined}
      onAdd={onAdd}
    />
  );
}
