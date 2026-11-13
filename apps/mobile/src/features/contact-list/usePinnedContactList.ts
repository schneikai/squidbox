import pinnedList from './pinnedList';

import useOpenLibrary from '@/library/useOpenLibrary';
import { readContactSettings } from '@/sync/contactSettingsRepository';
import * as schema from '@/sync/db/schema';
import contactListQuery from '@/sync/queries/contactListQuery';
import { useLiveQuery } from '@/sync/useLiveQuery';

const listsQuery = contactListQuery({ withMembers: false });

/**
 * What is pinned to the top of Contacts in place of Favorites (pinnedList; null for Favorites) and
 * the user's lists it is chosen from (with their counts), live; each undefined while reading. A built-in
 * list can be pinned only in an account's library (`canPinBuiltIn`): its pin is synced with the
 * account's contact settings.
 */
export default function usePinnedContactList({ isLive }: { isLive?: boolean } = {}) {
  const { userId } = useOpenLibrary();
  const data = useLiveQuery(
    // One transaction, so a sync that changes the pin between the two reads isn't half seen.
    (db) =>
      db.transaction(async (tx) => {
        const lists = await listsQuery.read(tx);
        const settings = userId ? await readContactSettings(tx, userId) : null;
        return { lists, pinned: pinnedList(lists, settings) };
      }),
    [...listsQuery.tables, schema.contactSettings],
    [listsQuery.descriptor, userId],
    { isLive },
  );
  return { lists: data?.lists, pinned: data?.pinned, canPinBuiltIn: userId !== null };
}
