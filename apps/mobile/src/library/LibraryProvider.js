import { useEffect, useMemo, useState } from 'react';

import LibraryContext from './LibraryContext';
import { getLibrary } from './current';
import { openBootLibrary } from './openBootLibrary';
import { setLibraryOwner } from './registry';

// The libraries on this device and the open one. Opens the boot library at mount, alongside the
// cloud init below it; LibraryGate (App.js) mounts the app once it is open.
export default function LibraryProvider({ children }) {
  const [libraries, setLibraries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    openBootLibrary().then((registry) => setLibraries(registry.libraries), setError);
  }, []);

  // The open library now belongs to this owner, in its database (already written) and in the list.
  async function setOwnerAsync(owner) {
    const registry = await setLibraryOwner(getLibrary().id, owner);
    setLibraries(registry.libraries);
  }

  const value = useMemo(() => {
    const library = libraries.length > 0 ? libraries.find(({ id }) => id === getLibrary().id) : null;
    return { library, libraries, setOwnerAsync };
  }, [libraries]);

  if (error) throw error; // a database that won't open or migrate: BootErrorBoundary
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
