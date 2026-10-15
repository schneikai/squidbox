import { openLibrary } from './current';
import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry, updateRegistry, type Library, type Registry } from './registry';

import { openAppDb } from '@/sync/db/client';
import getNewItemId from '@/utils/getNewItemId';

// Boot: load the library list (rebuilt from the databases when there is none) and open the one
// library it holds, creating this device's library on a fresh install.
export async function openBootLibrary(): Promise<Registry> {
  let registry = await loadRegistry(() => rebuildRegistry({ openDb: openAppDb }));
  if (registry.libraries.length === 0) {
    const device: Library = { id: getNewItemId(), owner: { kind: 'device' } };
    registry = await updateRegistry(({ libraries }) => ({ libraries: [...libraries, device] }));
  }
  await openLibrary(registry.libraries[0]!);
  return registry;
}
