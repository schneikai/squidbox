import { channelById } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import Page from '@/components/Page';
import ThreadParts from '@/components/ThreadParts';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useMentionSheet from '@/features/post-mentions/useMentionSheet';
import useMentionedContacts from '@/features/post-mentions/useMentionedContacts';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import readPostCopies, { postCopiesTables } from '@/sync/queries/readPostCopies';
import { useLiveQuery } from '@/sync/useLiveQuery';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

/**
 * A channel copy as it goes out, pushed in the Send to channels sheet from its card: the channel's
 * name and when it was sent in the header, then its posts as the post's screen shows a post and its
 * thread (PostView, then a ThreadPost each), every picture, each mention as the contact's handle on
 * the channel, and a copy icon per text that copies it as the channel gets it. A copy removed
 * meanwhile closes the screen.
 */
export default function ChannelCopyViewScreen() {
  const navigation = useNavigation();
  const { postId, copyId } = useLocalSearchParams<{ postId: string; copyId: string }>();
  const copy = useLiveQuery(async (db) => (await readPostCopies(db, postId, { copyId }))[0] ?? null, postCopiesTables, [
    postId,
    copyId,
  ]);
  const { contactsById, isRead: areContactsRead } = useMentionedContacts(copy?.posts);
  const { onPressMention, sheet } = useMentionSheet(contactsById);
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const channel = channelById(copy?.channelId);
  useCloseWhenGone(copy && !channel ? null : copy, 'This copy was deleted');

  if (!copy || !channel || !areContactsRead) return null;

  const [first, ...following] = copy.posts.map(({ text, mentions, assets }, index) => ({
    id: String(index),
    text,
    mentions,
    postAssets: assets.map((asset) => ({ id: asset.id, asset })),
  }));

  return (
    <Page testID="channel-copy-screen">
      <FloatingDetailHeader
        title={channel.name}
        subtitle={copy.sentAt === null ? 'Not sent' : `Sent ${dateToTimeAgo(copy.sentAt)}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}>
        {first && (
          <PostView
            post={{ ...first, postedAt: null }}
            contactsById={contactsById}
            channel={channel}
            onPressMention={onPressMention}
            isCopyable
          />
        )}
        <ThreadParts
          parts={following}
          renderPart={(part) => (
            <ThreadPost
              post={part}
              contactsById={contactsById}
              channel={channel}
              onPressMention={onPressMention}
              isCopyable
            />
          )}
        />
      </ScrollView>
      {sheet}
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
});
