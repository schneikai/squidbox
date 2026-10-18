// The entries of an editor's `values` that differ from the `original` it was seeded with: what the
// user changed. Saving only these keeps an edit another device made meanwhile to a field the user
// didn't touch (sync-design §6). Values compare by their JSON, so arrays of refs compare by content.
export default function changedValues(original, values) {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key])),
  );
}
