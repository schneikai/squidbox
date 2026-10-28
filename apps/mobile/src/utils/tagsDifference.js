/** What turns the tag list `from` into `to` (`{ add, remove }`), by tag in any case. */
export default function tagsDifference(from, to) {
  const fromKeys = new Set(from.map(keyOf));
  const toKeys = new Set(to.map(keyOf));
  return {
    add: to.filter((tag) => !fromKeys.has(keyOf(tag))),
    remove: from.filter((tag) => !toKeys.has(keyOf(tag))),
  };
}

function keyOf(tag) {
  return tag.trim().toLowerCase();
}
