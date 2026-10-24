import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';

import ThumbnailRow from '@/components/ThumbnailRow';
import { MIN_REREAD_INTERVAL } from '@/constants';
import postQuery from '@/features/post-list/postQuery';
import listTextStyles from '@/styles/listTextStyles';
import { useLiveQuery } from '@/sync/useLiveQuery';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

const identity = (onPress) => onPress;

/**
 * Every post in `scope` (postQuery's), newest first by postedAt (never-posted ones last), as rows
 * that each show the post's first asset, its caption and when it was posted, and open the post;
 * `emptyText` shows instead while there are none (nothing until they've been read). `guardPress` may wrap
 * the rows' presses (useDetailsPanelDrag's); `isLive: false` reads them once (useLiveQuery's).
 */
export default function PostRows({ scope, emptyText, guardPress = identity, isLive }) {
  const navigation = useNavigation();
  const posts = useScopePosts(scope, isLive);

  if (!posts) return null;
  if (posts.length === 0) return <Text style={listTextStyles.subtitle}>{emptyText}</Text>;

  return posts.map((post, index) => (
    <ThumbnailRow
      key={post.id}
      asset={post.postAssets[0]?.asset}
      {...postRowText(post)}
      isLast={index === posts.length - 1}
      onPress={guardPress(() => navigation.push('PostScreen', { postId: post.id }))}
    />
  ));
}

// The caption over when it was posted; a post without a caption shows only the date.
function postRowText(post) {
  const posted = post.postedAt ? dateToTimeAgo(post.postedAt) : 'Not posted yet';
  const caption = post.text?.trim();
  return caption ? { title: caption, subtitle: posted } : { title: posted };
}

function useScopePosts(scope, isLive) {
  const query = postQuery({ scope });
  return useLiveQuery(
    async (db) => (await query.read(db, { withCount: false, firstAssetOnly: true })).rows,
    query.tables,
    [query.descriptor],
    { minInterval: MIN_REREAD_INTERVAL, isLive },
  );
}
