import { sql } from 'drizzle-orm';

/**
 * The channels of a post's live other versions: each one's `channelId` and its `extraChannelIds` (one
 * without a channel left out, as readPost leaves it out of `channelPosts`), read over
 * posts_channel_root_idx, as a field of a select from posts aliased `p`: a JSON array, parsed, in no
 * set order and which may repeat a channel. `p.id` is spelled out (threadCount says why).
 */
const otherChannelIds = sql`(select json_group_array(json_each.value) from posts o,
    json_each(json_insert(coalesce(o.extra_channel_ids, '[]'), '$[#]', o.channel_id))
    where o.channel_root_id = p.id and o.deleted_at is null and o.channel_id is not null)`
  .mapWith((value: string) => JSON.parse(value) as string[])
  .as('other_channel_ids');

export default otherChannelIds;
