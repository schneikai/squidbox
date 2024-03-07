import * as Yup from 'yup';

import getNewItemId from '@/utils/getNewItemId';

const postAssetsSchema = Yup.object()
  .shape({
    id: Yup.string().default(getNewItemId),
    assetId: Yup.string().required(),
  })
  .noUnknown();

export default postAssetsSchema;
