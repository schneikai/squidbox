import apiWithAuthentication from '../apiWithAuthentication';

export default async function getUserAsync() {
  const { data } = await apiWithAuthentication.get('user');
  return data;
}
