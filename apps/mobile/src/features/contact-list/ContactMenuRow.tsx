import { memo } from 'react';

import ContactRow from './ContactRow';
import ContactRowMenu from './ContactRowMenu';
import type { ContactSummary } from './contactQuery';

/**
 * A contact in a list of contacts that opens the contact on a tap and its menu (ContactRowMenu) on
 * a long press. `isFirst` and `isLast` as ContactRow's. Memo, so a list's rows redraw only when
 * their contact or their place in the card changes.
 */
type ContactMenuRowProps = { contact: ContactSummary; isFirst: boolean; isLast: boolean };

function ContactMenuRow({ contact, isFirst, isLast }: ContactMenuRowProps) {
  return (
    <ContactRowMenu
      contact={contact}
      trigger={({ openFromLongPress }) => (
        <ContactRow contact={contact} onLongPress={openFromLongPress} isFirst={isFirst} isLast={isLast} />
      )}
    />
  );
}

export default memo(ContactMenuRow);
