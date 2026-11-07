import { CONTACT_LIMITS, type ContactPlace, formatPlace, placeParts } from '@squidbox/shared';

import FillMark from './FillMark';
import IconRowsCard from './IconRowsCard';

/**
 * A contact's places as a card: each place one row, its city over "State, Country" (what it has
 * when it has no city), opening it with `onEdit(index)`; "Add location" at the card's end calls
 * `onAdd()` until it holds CONTACT_LIMITS.places. `filledIndex` is a place filled in for the user,
 * marked with the sparkle (FillMark). The places are edited in a sheet (PlaceEditor).
 */
type PlacesFieldProps = {
  places: readonly (ContactPlace | string)[];
  onEdit: (index: number) => void;
  onAdd: () => void;
  filledIndex?: number;
};

export default function PlacesField({ places, onEdit, onAdd, filledIndex }: PlacesFieldProps) {
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
          accessibilityHint: 'Edits the location',
          trailing: 'chevron',
          mark: index === filledIndex ? <FillMark /> : undefined,
        };
      })}
      addLabel={places.length < CONTACT_LIMITS.places ? 'Add location' : undefined}
      onAdd={onAdd}
    />
  );
}
