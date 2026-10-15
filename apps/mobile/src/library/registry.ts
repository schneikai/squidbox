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
const listeners = new Set<(registry: Registry) => void>();

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
    for (const listener of listeners) listener(registry);
    return registry;
  });
  chain = next.catch(() => {});
  return next;
}

// Called after every stored change (LibraryProvider mirrors the list into React state).
export function onRegistryChange(listener: (registry: Registry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateLibrary(id: string, change: (library: Library) => Library): Promise<Registry> {
  return updateRegistry(({ libraries }) => ({
    libraries: libraries.map((library) => (library.id === id ? change(library) : library)),
  }));
}

export function setLibraryOwner(id: string, owner: Owner): Promise<Registry> {
  return updateLibrary(id, (library) => ({ ...library, owner }));
}

// The account's library, or none yet. A library whose serverId is still null is the account's
// until resolved (sessionMatches.ts has the same rule); a session without a userId (a converted
// install before its first /me) can only mean the one such library.
export function findAccountLibrary(
  libraries: Library[],
  serverId: string | null,
  userId: string | null,
): Library | undefined {
  return libraries.find(({ owner }) => {
    if (owner.kind !== 'account') return false;
    if (userId === null) return owner.serverId === null;
    if (owner.userId !== userId) return false;
    return owner.serverId === serverId || owner.serverId === null || serverId === null;
  });
}

export function deviceLibrary(libraries: Library[]): Library | undefined {
  return libraries.find(({ owner }) => owner.kind === 'device');
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
