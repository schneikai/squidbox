import type { ContactSettings } from '@/sync/contactSettingsRepository';
import type * as schema from '@/sync/db/schema';
import { builtInContactList } from '@/sync/queries/builtInContactLists';
import type { ContactScope } from '@/sync/queries/contactQuery';

/** What shows at the top of Contacts in place of Favorites: its list's id, name and contacts' scope. */
export type PinnedContactList = { id: string; name: string; scope: ContactScope };

/**
 * The list pinned to the top of Contacts in place of Favorites, of the user's `lists` and the
 * built-in one their `settings` name (Favorites too, when picked): the one picked last, should two
 * devices have picked one each before they synced; null for Favorites.
 */
export default function pinnedList(
  lists: Pick<schema.ContactListRow, 'id' | 'name' | 'pinnedAt'>[] | undefined,
  settings: ContactSettings | null | undefined,
): PinnedContactList | null {
  let pinned: (PinnedContactList & { pinnedAt: number }) | null = null;
  for (const list of lists ?? []) {
    if (list.pinnedAt != null && (pinned === null || list.pinnedAt > pinned.pinnedAt))
      pinned = { id: list.id, name: list.name, scope: { listId: list.id }, pinnedAt: list.pinnedAt };
  }
  // The settings' pick (Favorites too), when it came after the list's.
  const builtIn = builtInContactList(settings?.pinnedListId ?? undefined);
  if (builtIn && settings?.pinnedAt != null && (pinned === null || settings.pinnedAt > pinned.pinnedAt))
    return builtIn.id === 'favorites' ? null : { id: builtIn.id, name: builtIn.name, scope: builtIn.scope };
  return pinned && { id: pinned.id, name: pinned.name, scope: pinned.scope };
}
