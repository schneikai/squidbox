import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Owner } from './owner';

export interface Library {
  id: string;
  owner: Owner;
  // For display while the library is parked: what hadn't synced when it was closed.
  closed?: { pendingCount: number; atRiskCount: number; at: number };
  // A merge into another library is under way (library-ownership plan §1.5 (f)).
  mergedInto?: string;
}

export interface Registry {
  libraries: Library[];
}

// One JSON value, kept as one in-memory copy and changed only through updateRegistry, so concurrent
// writers never lose an update. The owners stored in the databases themselves make it rebuildable.
const REGISTRY_KEY = 'libraries';

let registry: Registry | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function getRegistry(): Registry {
  if (!registry) throw new Error('The library list is not loaded yet (see LibraryProvider).');
  return registry;
}

// Loads the stored list. A missing one is rebuilt; one that doesn't parse is moved aside (never
// treated as "no libraries", never a boot error) and rebuilt as well.
export async function loadRegistry(rebuild: () => Promise<Registry>): Promise<Registry> {
  const raw = await AsyncStorage.getItem(REGISTRY_KEY);
  const stored = raw === null ? null : parseRegistry(raw);
  if (raw !== null && stored === null) await AsyncStorage.setItem(`${REGISTRY_KEY}.corrupt-${Date.now()}`, raw);
  registry = stored ?? (await rebuild());
  if (!stored) await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return registry;
}

export function updateRegistry(change: (registry: Registry) => Registry): Promise<Registry> {
  const next = chain.then(async () => {
    registry = change(getRegistry());
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    return registry;
  });
  chain = next.catch(() => {});
  return next;
}

export function setLibraryOwner(id: string, owner: Owner): Promise<Registry> {
  return updateRegistry(({ libraries }) => ({
    libraries: libraries.map((library) => (library.id === id ? { ...library, owner } : library)),
  }));
}

function parseRegistry(raw: string): Registry | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.libraries)) return null;
    if (!parsed.libraries.every((library: Library) => typeof library?.id === 'string' && library.owner?.kind))
      return null;
    return parsed as Registry;
  } catch {
    return null;
  }
}
