/* eslint-disable @typescript-eslint/no-explicit-any -- works on any record shape */
import { useMemo, useRef } from 'react';

import { deriveRecords, type DerivedRecords } from './deriveRecords';

/** Live rows plus derived fields as stable id-keyed records (see deriveRecords). Memoize `extrasOf`. */
export function useDerivedRecords(rows: any[], extrasOf: (row: any) => Record<string, unknown>): Record<string, any> {
  const previous = useRef<DerivedRecords | undefined>(undefined);
  return useMemo(() => {
    previous.current = deriveRecords(rows, extrasOf, previous.current);
    return previous.current.records;
  }, [rows, extrasOf]);
}
