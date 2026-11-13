import { CONTACT_LIMITS, type ContactPlace } from '@squidbox/shared';

import placesWith from '@/utils/contacts/placesWith';
import storedPlace from '@/utils/contacts/storedPlace';

/**
 * A contact's places as stored, with `from` (the place a sheet opened with, null for a new one) taken
 * to `to` (null to take it out), within CONTACT_LIMITS.places. `from` is found again by its value, so
 * a change to the places meanwhile (another device's) keeps the edit on its place: one gone since is
 * added at the end again, or, for a removal, stays gone.
 */
export default function placesChanged(
  places: readonly (ContactPlace | string)[],
  from: ContactPlace | null,
  to: ContactPlace | null,
): ContactPlace[] {
  const key = (place: ContactPlace | string | null) => JSON.stringify(storedPlace(place));
  const index = from === null ? -1 : places.findIndex((place) => key(place) === key(from));
  const changed =
    from !== null && index === -1 && to === null ? places : placesWith(places, index === -1 ? null : index, to);
  return changed
    .map(storedPlace)
    .filter((place): place is ContactPlace => place !== null)
    .slice(0, CONTACT_LIMITS.places);
}
