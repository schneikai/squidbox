import { channelById, type Channel } from '@squidbox/shared';

import { readChannels } from '@/sync/channelsRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The user's channels, live, in their order (one this build doesn't know left out); undefined while reading. */
export default function useChannels(): Channel[] | undefined {
  return useLiveQuery(
    async (db) => (await readChannels(db)).flatMap((row) => channelById(row.channelId) ?? []),
    [schema.channels],
  );
}
