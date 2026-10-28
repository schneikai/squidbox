import { ASSET_TAG_LIMITS } from '@squidbox/shared';

import usePhotoTagsEdit from './usePhotoTagsEdit';

import TagsField from '@/components/TagsField';

/**
 * The tags of `asset` (its live row), edited in place (usePhotoTagsEdit): a tap on a chip takes it
 * off, Add adds one. `isDisabled` while a tagging runs; `guardPress`, TagsField's.
 */
export default function PhotoTagsField({ asset, placeholder, isDisabled, guardPress }) {
  const { tags, change } = usePhotoTagsEdit(asset);
  return (
    <TagsField
      tags={tags}
      onChange={change}
      placeholder={placeholder}
      maxTags={ASSET_TAG_LIMITS.tags}
      maxTagLength={ASSET_TAG_LIMITS.tag}
      isDisabled={isDisabled}
      guardPress={guardPress}
    />
  );
}
