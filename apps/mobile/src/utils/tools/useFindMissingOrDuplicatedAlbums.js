import useAlbums from '@/features/albums-context/useAlbums';

export default function useFindMissingOrDuplicatedAlbums() {
  const { albums } = useAlbums();

  function findMissingOrDuplicatedAlbums() {
    const objects = Object.values(albums);

    // Create a set of all existing names in the objects array
    const existingNames = new Set();
    const nameCount = new Map();

    // Count occurrences and populate existing names
    for (const obj of objects) {
      existingNames.add(obj.name);
      nameCount.set(obj.name, (nameCount.get(obj.name) || 0) + 1);
    }

    // Function to pad numbers with leading zeros
    const padWithZeros = (number) => String(number).padStart(3, '0');

    // Create an array of all expected names
    const expectedNames = [];
    for (let i = 1; i <= 308; i++) {
      expectedNames.push(padWithZeros(i));
    }

    // Filter out the names that are missing in the objects array
    const missingNames = expectedNames.filter((name) => !existingNames.has(name));

    // Find duplicates
    const duplicateNames = Array.from(nameCount)
      .filter(([name, count]) => count > 1)
      .map(([name]) => name);

    console.log('Missing names:', missingNames);
    console.log('Duplicate names:', duplicateNames);
  }

  return findMissingOrDuplicatedAlbums;
}
