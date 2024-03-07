import * as Yup from 'yup';

import postAssetsSchema from './postAssetsSchema';

import getTimestamp from '@/utils/date-time/getTimestamp';
import getNewItemId from '@/utils/getNewItemId';

const postSchema = Yup.object()
  .shape({
    id: Yup.string().default(getNewItemId),
    text: Yup.string().default(''),
    assetRefs: Yup.array().of(postAssetsSchema).default([]),
    isFavorite: Yup.boolean().default(false),
    isDeleted: Yup.boolean().default(false),
    postedAt: Yup.number().nullable().default(null),
    createdAt: Yup.number().default(getTimestamp),
    updatedAt: Yup.number().default(getTimestamp),
    rePostId: Yup.string().nullable().default(null), // Id of the post that this post is a repost of.
  })
  .test('textOrAssetRefs', 'Either text or assets must be present', function (value) {
    return value.text || (value.assetRefs && value.assetRefs.length > 0);
  })
  .noUnknown();

export default postSchema;
