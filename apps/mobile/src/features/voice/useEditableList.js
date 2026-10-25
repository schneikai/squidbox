import { useState } from 'react';

/**
 * A list of texts edited in place (Rules, Example posts): `change(index, text)`, `remove(index)`,
 * and `add()`, which appends an empty one that `isAdded(index)` says should take the focus once.
 * Each calls `onChange(list)` with the whole list.
 */
export default function useEditableList(list, onChange) {
  // The item add() just made.
  const [addedIndex, setAddedIndex] = useState(null);

  function change(index, text) {
    onChange(list.map((each, i) => (i === index ? text : each)));
  }

  function remove(index) {
    onChange(list.filter((_, i) => i !== index));
  }

  function add() {
    setAddedIndex(list.length);
    onChange([...list, '']);
  }

  return { change, remove, add, isAdded: (index) => index === addedIndex };
}
