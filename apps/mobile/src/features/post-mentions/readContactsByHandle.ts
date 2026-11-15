import contactsByHandle from './contactsByHandle';

import type { SyncDb } from '@/sync/db/types';
import contactQuery from '@/sync/queries/contactQuery';

/** Which live contacts a typed @handle means (contactsByHandle), over every live contact read once. */
export default async function readContactsByHandle(db: SyncDb): Promise<ReturnType<typeof contactsByHandle>> {
  return contactsByHandle(await contactQuery({}).summaries(db));
}
