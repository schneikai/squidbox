import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** The vision Verify's photos: file name → `data:image/jpeg;base64,…` URL. */
export default async function fetchVerifyPhotosAsync() {
  const { data } = await apiWithAuthentication.get('ai/verify-photos');
  return data.photos;
}
