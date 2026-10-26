import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import fetchAiBalanceAsync from '@/utils/cloud-api/ai/fetchAiBalanceAsync';

/**
 * The Venice account's balance as text ("$4.59", with DIEM when there is any), read again each time
 * the screen comes into focus, so it follows the compares just run. `isError` when the last read
 * failed; the value is null until the first read is in.
 */
export default function useVeniceBalance() {
  const [state, setState] = useState({ value: null, isError: false });

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      fetchAiBalanceAsync()
        .then((balance) => isCurrent && setState({ value: balanceText(balance), isError: false }))
        .catch(() => isCurrent && setState({ value: "couldn't load", isError: true }));
      return () => {
        isCurrent = false;
      };
    }, []),
  );

  return state;
}

function balanceText({ usd, diem }) {
  const dollars = `$${usd.toFixed(2)}`;
  return diem > 0 ? `${dollars} · ${diem.toFixed(2)} DIEM` : dollars;
}
