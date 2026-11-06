import tagKey from '@/utils/tagKey';

/** An edit of a tag list: the tags to add and the ones to take out. */
export type TagsEdit = { add: string[]; remove: string[] };

/** What turns the tag list `from` into `to` (`{ add, remove }`), by tag in any case. */
export default function tagsDifference(from: readonly string[], to: readonly string[]): TagsEdit {
  const fromKeys = new Set(from.map(tagKey));
  const toKeys = new Set(to.map(tagKey));
  return {
    add: to.filter((tag) => !fromKeys.has(tagKey(tag))),
    remove: from.filter((tag) => !toKeys.has(tagKey(tag))),
  };
}
