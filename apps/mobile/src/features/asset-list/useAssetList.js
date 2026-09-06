import { useRef } from 'react';

export default function useAssetList() {
  const listRef = useRef();

  function listScrollTop() {
    listRef.current.scrollToOffset({ animated: true, offset: 0 });
  }

  return { listRef, listScrollTop };
}
