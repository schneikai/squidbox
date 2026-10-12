import apiWithAuthentication from '../apiWithAuthentication';

export default async function getUserAsync() {
  // GET /me → { user: { id, email } }
  const { data } = await apiWithAuthentication.get('me');
  return data.user;
}
