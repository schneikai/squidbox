import tagKey from '@/utils/tagKey';

/** What turns the tag list `from` into `to` (`{ add, remove }`), by tag in any case. */
export default function tagsDifference(from, to) {
  const fromKeys = new Set(from.map(tagKey));
  const toKeys = new Set(to.map(tagKey));
  return {
    add: to.filter((tag) => !fromKeys.has(tagKey(tag))),
    remove: from.filter((tag) => !toKeys.has(tagKey(tag))),
  };
}
