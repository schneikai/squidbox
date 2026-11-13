import { CONTACT_PLACE_PARTS, type ContactPlace, placeParts } from '@squidbox/shared';

/** A place's parts trimmed, or null when none is left. */
export default function storedPlace(place: Partial<ContactPlace> | string | null | undefined): ContactPlace | null {
  const parts = placeParts(place);
  const trimmed: ContactPlace = { city: parts.city.trim(), state: parts.state.trim(), country: parts.country.trim() };
  return CONTACT_PLACE_PARTS.some((part) => trimmed[part]) ? trimmed : null;
}
