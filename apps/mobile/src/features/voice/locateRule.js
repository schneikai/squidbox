/**
 * Where a stored rule is in `rules` now, after a sync may have moved or changed the list: `index`
 * if its `text` is still there, else the first rule with that text, -1 when it's gone.
 */
export default function locateRule(rules, { index, text }) {
  return rules[index] === text ? index : rules.indexOf(text);
}
