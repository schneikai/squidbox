import { use } from 'react';

import ContactsContext from './ContactsContext';

export default function useContacts() {
  return use(ContactsContext);
}
