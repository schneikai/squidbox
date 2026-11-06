import { createContext } from 'react';

// What CloudSyncProvider gives: the backup run's state and progress, and the call that starts one.
export type CloudSyncValue = {
  backupError: string | null;
  isSyncing: boolean;
  syncMessage: string | null;
  syncProgressMessage: { sent: string; total: string; percent: string } | null;
  syncSpeedMessage: { now: string; avg: string } | null;
  syncNow: () => Promise<void>;
};

const CloudSyncContext = createContext<CloudSyncValue | null>(null);

export default CloudSyncContext;
