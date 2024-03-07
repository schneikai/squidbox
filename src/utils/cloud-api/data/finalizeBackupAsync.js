import apiWithAuthentication from '../apiWithAuthentication';

export default async function finalizeBackupAsync(backupFiles) {
  const { data } = await apiWithAuthentication.post('data_backup/finalize', { backupFiles });
  return data;
}
