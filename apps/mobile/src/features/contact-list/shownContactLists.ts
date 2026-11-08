import type { ContactSort } from './contactSortOptions';

import { matchingIds } from '@/sync/matchingIds';

type ShownList = { id: string; name: string; createdAt: number };

const byName = (a: ShownList, b: ShownList) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The lists a list of lists shows (the Lists screen, the list picker): those whose name matches
 * `searchText` (all while it is empty), in `sortOrder`, the contacts' sort choices: by name, or the
 * newest first (by name where they tie).
 */
export default function shownContactLists<List extends ShownList>(
  lists: List[],
  searchText: string,
  sortOrder: ContactSort,
): List[] {
  const search = searchText.trim().toLowerCase();
  const matched = search
    ? new Set(
        matchingIds(
          lists.map((list) => ({ id: list.id, text: list.name.toLowerCase() })),
          search,
        ),
      )
    : undefined;
  const shown = matched ? lists.filter((list) => matched.has(list.id)) : [...lists];
  return shown.sort(sortOrder === 'createdAt:desc' ? (a, b) => b.createdAt - a.createdAt || byName(a, b) : byName);
}
