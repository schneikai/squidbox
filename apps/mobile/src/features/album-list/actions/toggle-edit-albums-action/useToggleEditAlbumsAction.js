import { useState } from 'react';

export default function useToggleEditAlbumsAction() {
  const [isEditMode, setIsEditMode] = useState(false);

  function toggleEditMode() {
    setIsEditMode((isSelectMode) => !isSelectMode);
  }

  return {
    isEditMode,
    toggleEditMode,
  };
}
