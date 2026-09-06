import apiWithAuthentication from '../apiWithAuthentication';

export default async function initBackupAsync(dataFiles) {
  const { data } = await apiWithAuthentication.post('data_backup/init', { dataFiles });
  return data;
}
