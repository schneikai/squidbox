import * as Yup from 'yup';

import { MEDIA_TYPES } from './constants';
import getNewAssetId from './getNewAssetId';

import getTimestamp from '@/utils/date-time/getTimestamp';

const assetSchema = Yup.object()
  .shape({
    id: Yup.string().default(getNewAssetId),
    // Heads-up: Some older assets have __UNKNOWN__ here because
    // we didn't save the mediaLibraryAssetId in the past.
    mediaLibraryAssetId: Yup.string().required(),
    mediaType: Yup.string().oneOf(Object.values(MEDIA_TYPES)).required(),
    width: Yup.number().required(),
    height: Yup.number().required(),
    fileSize: Yup.number().required(),
    duration: Yup.number().nullable().default(null),
    filename: Yup.string().required(),
    thumbnailFilename: Yup.string().required(),
    isFileSynced: Yup.boolean().default(false),
    isThumbnailSynced: Yup.boolean().default(false),
    isSynced: Yup.boolean().default(false),
    syncError: Yup.string().nullable().default(null),
    isFavorite: Yup.boolean().default(false),
    isDeleted: Yup.boolean().default(false),
    createdAt: Yup.number().default(getTimestamp),
    updatedAt: Yup.number().default(getTimestamp),
    postHistory: Yup.array().of(Yup.string()).default([]),
    lastPostedAt: Yup.number().nullable().default(null),
    oldFileId: Yup.string().nullable().default(null),
  })
  .noUnknown();

export default assetSchema;
