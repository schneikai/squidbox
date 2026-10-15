import { useRef } from 'react';

export default function usePostList() {
  const listRef = useRef();

  // Called on a new sort or filter, so not animated: the new first page lands at the top, where an
  // animated scroll would still be passing the end of the shorter list and load a second page early.
  function listScrollTop() {
    listRef.current.scrollToOffset({ animated: false, offset: 0 });
  }

  return { listRef, listScrollTop };
}
