import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Owner } from './owner';

export interface Library {
  id: string;
  owner: Owner;
  // The library this one joins (library-ownership plan §1.5 (f)): set while the merge runs, and kept
  // when the source stays for photos in another account's storage, so it never joins another one.
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

// `change` returns the same object for no change, which writes nothing.
export function updateRegistry(change: (registry: Registry) => Registry): Promise<Registry> {
  const next = chain.then(async () => {
    const changed = change(getRegistry());
    if (changed === registry) return changed;
    registry = changed;
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
  return updateRegistry((current) => {
    const library = current.libraries.find((entry) => entry.id === id);
    if (!library) return current;
    const changed = change(library);
    if (changed === library) return current;
    return { libraries: current.libraries.map((entry) => (entry === library ? changed : entry)) };
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
