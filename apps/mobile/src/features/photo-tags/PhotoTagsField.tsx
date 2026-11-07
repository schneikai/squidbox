import { ASSET_TAG_LIMITS } from '@squidbox/shared';

import usePhotoTagsEdit from './usePhotoTagsEdit';

import TagsField, { type TagsFieldProps } from '@/components/TagsField';
import type { AssetRow } from '@/sync/db/schema';

export type PhotoTagsFieldProps = { asset: Pick<AssetRow, 'id' | 'tags'> } & Required<
  Pick<TagsFieldProps, 'disabled' | 'guardPress'>
>;

/**
 * The tags of `asset` (its live row), edited in place (usePhotoTagsEdit): a chip's × takes it
 * off, Add adds one. `disabled` while a tagging runs; `guardPress`, TagsField's.
 */
export default function PhotoTagsField({ asset, disabled, guardPress }: PhotoTagsFieldProps) {
  const { tags, change } = usePhotoTagsEdit(asset);
  return (
    <TagsField
      tags={tags}
      onChange={change}
      maxTags={ASSET_TAG_LIMITS.tags}
      maxTagLength={ASSET_TAG_LIMITS.tag}
      disabled={disabled}
      guardPress={guardPress}
      isFlush
    />
  );
}
