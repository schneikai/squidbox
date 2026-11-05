import contactQuery from '@/features/contact-list/contactQuery';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The live contacts on a photo, album or post (`{ targetType, targetId }`), by name; undefined while
 * reading. `isLive: false` reads them once (useLiveQuery's).
 */
export default function useTargetContacts({ targetType, targetId }, { isLive } = {}) {
  const query = contactQuery({ scope: { targetType, targetId } });
  const result = useLiveQuery((db) => query.read(db), query.tables, [query.descriptor], { isLive });
  return result?.rows;
}
