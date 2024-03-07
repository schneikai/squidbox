import { useEffect, useState, useRef } from 'react';

import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default function useLoadAndUpdateData({ localDataFilename }) {
  const [data, setData] = useState({});
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!dataLoadedRef.current) return;
    writeLocalDataAsync(localDataFilename, data);
  }, [data]);

  function initializeData(data) {
    dataLoadedRef.current = true;
    setData(data);
  }

  return {
    data,
    setData,
    initializeData,
  };
}
