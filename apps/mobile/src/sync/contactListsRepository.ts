import type { ContactListRecord } from '@squidbox/shared';

import * as schema from './db/schema';
import { makeRepository } from './repository';

// The contact lists. Membership lives in the contact_list_members edge collection (membershipRepository).
export const { create, update, remove } = makeRepository<ContactListRecord>('contact_lists', schema.contactLists);
