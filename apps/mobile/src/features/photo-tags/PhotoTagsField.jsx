import { ASSET_TAG_LIMITS } from '@squidbox/shared';

import usePhotoTagsEdit from './usePhotoTagsEdit';

import TagsField from '@/components/TagsField';

/**
 * The tags of `rows` (live assets: one photo, or the chat's photos), edited in place
 * (usePhotoTagsEdit): a tap on a chip takes it off, Add adds one. `isDisabled` while a tagging
 * runs; `isBare` inside a card; `guardPress`, TagsField's.
 */
export default function PhotoTagsField({ rows, placeholder, isDisabled, isBare, guardPress }) {
  const { tags, change } = usePhotoTagsEdit(rows);
  return (
    <TagsField
      tags={tags}
      onChange={change}
      placeholder={placeholder}
      maxTags={ASSET_TAG_LIMITS.tags * rows.length}
      maxTagLength={ASSET_TAG_LIMITS.tag}
      isDisabled={isDisabled}
      isBare={isBare}
      guardPress={guardPress}
    />
  );
}
