import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import dollarsText from '@/utils/ai/dollarsText';
import fetchAiBalanceAsync from '@/utils/cloud-api/ai/fetchAiBalanceAsync';

/**
 * The Venice account's balance as text ("$4.59", with DIEM when there is any), read again each time
 * the screen comes into focus, so it follows the compares just run, and when `refreshKey` changes
 * (a compare round that ended; null holds the read, while one runs). `isError` when the last read failed; the value is null until the
 * first read is in.
 */
export default function useVeniceBalance(refreshKey) {
  const [state, setState] = useState({ value: null, isError: false });

  useFocusEffect(
    useCallback(() => {
      if (refreshKey === null) return undefined;
      let isCurrent = true;
      fetchAiBalanceAsync()
        .then((balance) => isCurrent && setState({ value: balanceText(balance), isError: false }))
        .catch(() => isCurrent && setState({ value: "couldn't load", isError: true }));
      return () => {
        isCurrent = false;
      };
    }, [refreshKey]),
  );

  return state;
}

function balanceText({ usd, diem }) {
  const dollars = dollarsText(usd);
  return diem > 0 ? `${dollars} · ${diem.toFixed(2)} DIEM` : dollars;
}
