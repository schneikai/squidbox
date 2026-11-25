import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import copyAsPost from './copyAsPost';
import copySentText from './copySentText';
import postsSentTo from './postsSentTo';

import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import PostThreadCards from '@/features/post-detail/PostThreadCards';
import useMentionSheet from '@/features/post-mentions/useMentionSheet';
import useMentionedContacts from '@/features/post-mentions/useMentionedContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import { REMOVED } from '@/sync/postCopiesRepository';
import { channelCopiesTables, readChannelCopy } from '@/sync/queries/readChannelCopies';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * A channel's card as it goes out (its stored copy, or the post as an untouched card shows it), pushed
 * in the Send to channels sheet from its card: the channel's
 * name and when it was sent in the header, then the posts that go out (postsSentTo) as the post's screen shows a post and its
 * thread (PostThreadCards), every picture, each mention as the contact's handle on
 * the channel, and a copy icon per text that copies it as the channel gets it. A card removed
 * meanwhile closes the screen.
 */
export default function ChannelCopyViewScreen() {
  const navigation = useNavigation();
  const { postId, copyId } = useLocalSearchParams<{ postId: string; copyId: string }>();
  const copy = useLiveQuery((db) => readChannelCopy(db, postId, copyId), channelCopiesTables, [postId, copyId]);
  const { contactsById, isRead: areContactsRead } = useMentionedContacts(copy?.posts);
  const { onPressMention, sheet } = useMentionSheet(contactsById);
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  useCloseWhenGone(copy, REMOVED);

  // The parts' ids only key the cards.
  const post = useMemo(() => {
    const asPost = copy && copyAsPost({ posts: postsSentTo(copy.channel, copy.posts) });
    if (!asPost) return null;
    const threadPosts = asPost.threadPosts.map((part, index) => ({ ...part, id: String(index + 1) }));
    return { ...asPost, id: '0', postedAt: null, threadPosts };
  }, [copy]);

  if (!copy || !areContactsRead) return null;
  const { channel } = copy;

  return (
    <Page testID="channel-copy-screen">
      <FloatingDetailHeader
        title={channel.name}
        subtitle={copy.sentAt === null ? 'Not sent' : copySentText(copy.sentAt)}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}>
        {post && (
          <PostThreadCards
            post={post}
            contactsById={contactsById}
            channel={channel}
            onPressMention={onPressMention}
            opensAssets={false}
          />
        )}
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
