import ContactsContext, { type ContactsContextValue } from './ContactsContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useContacts(): ContactsContextValue {
  return useRequiredContext(ContactsContext, 'useContacts needs a ContactsProvider above it');
}
