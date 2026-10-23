import { useRef } from 'react';

// A list ref and a way to jump that list back to its top, on a new sort or filter. Not animated: the
// new first page lands at the top, where an animated scroll would still be passing the end of the
// shorter list and load a second page early.
export default function useListScrollTop() {
  const listRef = useRef();

  function listScrollTop() {
    listRef.current.scrollToOffset({ animated: false, offset: 0 });
  }

  return { listRef, listScrollTop };
}
