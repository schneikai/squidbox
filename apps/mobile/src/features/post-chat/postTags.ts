import withEdits, { type ListEdits } from './withEdits';

import type { AssetRow } from '@/sync/db/schema';

/**
 * The tags the chat shows and sends for its post: its photos' (`rows`, the live assets) together,
 * with the card's edits (`tagEdits`, withEdits'), each once in any case. So a photo added later, or
 * tagged later, still brings its tags.
 */
export default function postTags(rows: readonly Pick<AssetRow, 'tags'>[], tagEdits: ListEdits): string[] {
  return withEdits(
    rows.flatMap((row) => row.tags ?? []),
    tagEdits,
  );
}
