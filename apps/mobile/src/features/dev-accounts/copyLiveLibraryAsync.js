import api from '@/utils/cloud-api/api';

// The first copy of a large library takes a while.
const COPY_TIMEOUT_MS = 10 * 60 * 1000;

// Has the local server copy the owner's live library into the library-copy account, unless it holds
// one already (apps/server/src/dev/routes.ts).
export default async function copyLiveLibraryAsync({ email, password }) {
  await api.post('dev/library-copy', { email, password }, { timeout: COPY_TIMEOUT_MS });
}
