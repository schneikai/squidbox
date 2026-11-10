import PhotoTagsField from './PhotoTagsField';
import useRetag from './useRetag';

import TagsSection from '@/components/TagsSection';
import type { GuardPress } from '@/lib/unguarded';
import type { AssetRow } from '@/sync/db/schema';

export type PhotoTagsSectionProps = { asset: AssetRow; guardPress: GuardPress };

/**
 * The asset's tags, in its details, always edited in place (PhotoTagsField: a chip's × takes it
 * off, Add adds one) under a Tags header, with the assistant's Tag it (Tag again once tagged) at the
 * header's end while it is available (the field takes no changes while it runs). `guardPress` (useDetailsPanelDrag's) keeps a touch that dragged the panel
 * from pressing a chip or a button. It never tags by itself.
 */
export default function PhotoTagsSection({ asset, guardPress }: PhotoTagsSectionProps) {
  const { retag, isRunning, error } = useRetag(asset);

  return (
    <TagsSection
      title="Tags"
      isFlush
      tagItLabel={asset.tags === null ? 'Tag it' : 'Tag again'}
      onTagIt={guardPress(() => retag())}
      isTagging={isRunning}
      error={error}
    >
      <PhotoTagsField asset={asset} disabled={isRunning} guardPress={guardPress} />
    </TagsSection>
  );
}
