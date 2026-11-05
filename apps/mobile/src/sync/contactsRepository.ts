import type { ContactRecord } from '@squidbox/shared';

import * as schema from './db/schema';
import { makeRepository } from './repository';

const repository = makeRepository<ContactRecord>('contacts', schema.contacts);

// `remove` is a tombstone (deletedAt): the contact leaves every list, photo, album and post with it.
// The photo (`avatarFilename`, a file field) is uploaded by the sync before the record is pushed.
export const { create, update, remove, toggle } = repository;
