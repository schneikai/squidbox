// The same tag in any case and spacing, for comparing tags.
export default function tagKey(tag) {
  return tag.trim().toLowerCase();
}
