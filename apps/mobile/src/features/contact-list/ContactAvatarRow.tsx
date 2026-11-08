import { router } from 'expo-router';

import type { ContactSummary } from './contactQuery';

import PictureRow from '@/components/PictureRow';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';

/**
 * The pinned row on Contacts (Favorites, or the list pinned in their place): each contact's avatar
 * (no heart) with its first name, side by side, opening the contact. `contacts` are the loaded ones
 * of a paged query; `loadMore` reads the next page as the row nears its end, as the lists do.
 */
type ContactAvatarRowProps = { contacts: ContactSummary[]; loadMore: () => void };

export default function ContactAvatarRow({ contacts, loadMore }: ContactAvatarRowProps) {
  return (
    <PictureRow
      items={contacts}
      keyOf={contactId}
      picture={avatar}
      label={firstName}
      accessibilityLabel={fullName}
      onPress={openContact}
      onEndReached={loadMore}
    />
  );
}

const contactId = (contact: ContactSummary) => contact.id;
const fullName = (contact: ContactSummary) => contact.name;
const firstName = (contact: ContactSummary) => contact.name.trim().split(/\s+/)[0];
const avatar = (contact: ContactSummary) => <ContactAvatar contact={contact} size="medium" />;
const openContact = (contact: ContactSummary) => router.navigate(`/contact/${contact.id}`);
