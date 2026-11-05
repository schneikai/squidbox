// The same tag in any case and spacing, for comparing tags.
export default function tagKey(tag: string): string {
  return tag.trim().toLowerCase();
}
