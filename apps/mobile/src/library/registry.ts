import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Owner } from './owner';

import { createPersistedStore } from '@/utils/persistedStore';

export interface Library {
  id: string;
  owner: Owner;
  // The library this one is joining: set while the merge runs, so a boot finishes one a crash
  // interrupted.
  mergedInto?: string;
  // The library this one joined and stays beside, for photos in another account's storage: never
  // merged again, never into another one.
  keptFor?: string;
}

export interface Registry {
  libraries: Library[];
}

// The owners stored in the databases themselves make the list rebuildable.
const REGISTRY_KEY = 'libraries';

const store = createPersistedStore<Registry>({
  name: 'The library list',
  write: (registry) => AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry)),
});

export const getRegistry = store.get;
export const updateRegistry = store.update;
export const onRegistryChange = store.subscribe;

// Loads the stored list. A missing one is rebuilt; one that doesn't parse is moved aside (never
// treated as "no libraries", never a boot error) and rebuilt as well.
export function loadRegistry(rebuild: () => Promise<Registry>): Promise<Registry> {
  return store.load(async () => {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    const stored = raw === null ? null : parseRegistry(raw);
    if (raw !== null && stored === null) await AsyncStorage.setItem(`${REGISTRY_KEY}.corrupt-${Date.now()}`, raw);
    if (stored) return stored;
    const rebuilt = await rebuild();
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(rebuilt));
    return rebuilt;
  });
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
