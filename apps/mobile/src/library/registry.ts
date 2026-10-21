import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MergeMarker } from './mergeMarker';
import type { Owner } from './owner';

import { createPersistedStore } from '@/utils/persistedStore';

export interface Library {
  id: string;
  owner: Owner;
  // The library this one is joining, and its account (mergeMarker.ts): set while the merge runs, so a
  // boot finishes one a crash interrupted.
  mergedInto?: MergeMarker;
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

// The installed build (df33378) stored a merge marker as the target library's id: it takes the
// account of that library, and goes when the library is gone or its owner unresolved (no serverId).
function withMarker(library: Library, _index: number, libraries: Library[]): Library {
  const marker = library.mergedInto as MergeMarker | string | undefined;
  if (typeof marker !== 'string') return library;
  const { mergedInto: _legacy, ...rest } = library;
  const owner = libraries.find(({ id }) => id === marker)?.owner;
  if (owner?.kind !== 'account' || !owner.serverId) return rest;
  return { ...rest, mergedInto: { library: marker, serverId: owner.serverId, userId: owner.userId } };
}

function parseRegistry(raw: string): Registry | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.libraries)) return null;
    if (!parsed.libraries.every((library: Library) => typeof library?.id === 'string' && library.owner?.kind))
      return null;
    return { libraries: parsed.libraries.map(withMarker) };
  } catch {
    return null;
  }
}
