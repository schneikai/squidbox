import type { ContactSort } from '@/features/contact-list/contactSortOptions';

/**
 * The lists in `sortOrder`, as the contacts sort: by name, or the newest first (by name where they
 * tie). `lists` come by name (contactListQuery), so Name keeps them as they are.
 */
export default function sortContactLists<List extends { name: string; createdAt: number }>(
  lists: List[],
  sortOrder: ContactSort,
): List[] {
  if (sortOrder === 'name:asc') return lists;
  return [...lists].sort(
    (a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}
