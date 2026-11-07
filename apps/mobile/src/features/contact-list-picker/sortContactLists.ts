import type { ContactListSort } from './contactListSortOptions';

type SortableList = { name: string; memberCount: number; createdAt: number };

const byName = (a: SortableList, b: SortableList) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The lists in `sortOrder`: by name; or most contacts first, or the newest first, either by name
 * where they tie. `lists` come by name (contactListQuery), so Name keeps them as they are.
 */
export default function sortContactLists<List extends SortableList>(lists: List[], sortOrder: ContactListSort): List[] {
  if (sortOrder === 'name:asc') return lists;
  const key = sortOrder === 'memberCount:desc' ? 'memberCount' : 'createdAt';
  return [...lists].sort((a, b) => b[key] - a[key] || byName(a, b));
}
