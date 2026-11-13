import { sql } from 'drizzle-orm';

/**
 * The `channelId`s of a post's live other channels, read over posts_channel_root_idx, as a field of a
 * select from posts aliased `p`: a JSON array, parsed. `p.id` is spelled out (threadCount says why).
 */
const otherChannelIds =
  sql`(select json_group_array(o.channel_id) from posts o where o.channel_root_id = p.id and o.deleted_at is null)`
    .mapWith((value: string) => JSON.parse(value) as string[])
    .as('other_channel_ids');

export default otherChannelIds;
