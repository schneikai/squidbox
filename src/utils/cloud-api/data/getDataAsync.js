import apiWithAuthentication from '../apiWithAuthentication';

export default async function getDataAsync() {
  const { data } = await apiWithAuthentication.get('data');
  return data;
}
