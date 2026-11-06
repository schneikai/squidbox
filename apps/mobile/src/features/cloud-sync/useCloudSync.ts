import CloudSyncContext, { type CloudSyncValue } from './CloudSyncContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useCloudSync(): CloudSyncValue {
  return useRequiredContext(CloudSyncContext, 'useCloudSync needs a CloudSyncProvider above it');
}
