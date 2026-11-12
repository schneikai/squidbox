import { resolveIdeaSettings } from '@squidbox/shared';
import { useMemo } from 'react';

import useOpenLibrary from '@/library/useOpenLibrary';
import { schema } from '@/sync/db/client';
import { readIdeaSettings } from '@/sync/ideaSettingsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The user's Post ideas and Repost ideas settings as the app uses them (resolveIdeaSettings: on, and
 * the built-in prompt, until set), live; undefined while reading.
 */
export default function useIdeaSettings() {
  const { userId } = useOpenLibrary();
  const stored = useLiveQuery(
    async (db) => (userId === null ? null : readIdeaSettings(db, userId)),
    [schema.ideaSettings],
    [userId],
  );
  return useMemo(() => (stored === undefined ? undefined : resolveIdeaSettings(stored)), [stored]);
}
