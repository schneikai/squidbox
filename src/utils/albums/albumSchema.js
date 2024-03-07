import * as Yup from 'yup';

import { SMART_ALBUM_TYPES } from './constants';

import getTimestamp from '@/utils/date-time/getTimestamp';
import getNewItemId from '@/utils/getNewItemId';

const albumSchema = Yup.object()
  .shape({
    id: Yup.string().default(getNewItemId),
    name: Yup.string().default('New Album'),
    assets: Yup.array().of(Yup.string()).default([]),
    isFavorite: Yup.boolean().default(false),
    archivedAt: Yup.number().nullable().default(null),
    isDeleted: Yup.boolean().default(false),
    createdAt: Yup.number().default(getTimestamp),
    updatedAt: Yup.number().default(getTimestamp),
    postHistory: Yup.array().of(Yup.string()).default([]),
    lastPostedAt: Yup.number().nullable().default(null),
    showInPostSuggestionsAfter: Yup.number().nullable().default(null),
    oldCollectionName: Yup.string().nullable().default(null),

    smartAlbumType: Yup.mixed()
      .oneOf([null, ...Object.values(SMART_ALBUM_TYPES)])
      .nullable()
      .default(null),
  })
  .noUnknown();

export default albumSchema;
