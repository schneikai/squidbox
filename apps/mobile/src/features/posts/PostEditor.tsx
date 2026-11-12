import type { ChatSubjectKind, IdeasKind } from '@squidbox/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import PostCard, { type PostCardChange, type PostCardContent, type PostCardData } from './PostCard';
import postedAtToSave, { type PickedPostedAt } from './postedAtToSave';

import EditSheet from '@/components/EditSheet';
import ThreadConnector from '@/components/ThreadConnector';
import toChatDraftPost from '@/features/post-chat/toChatDraftPost';
import IdeasTray from '@/features/post-ideas/IdeasTray';
import useEditorIdeas from '@/features/post-ideas/useEditorIdeas';
import type { PostWithAssets } from '@/features/post-list/postQuery';
import type { PostFields } from '@/features/posts-context/PostsContext';
import useEditSheet, { type EditSheetOptions } from '@/hooks/useEditSheet';
import type { ThreadPart } from '@/sync/postThreads';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';
import isPresent from '@/utils/isPresent';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

type PostEditorKind = Extract<ChatSubjectKind, 'draft' | 'edit'>;

// What the editor is seeded with: a post as readPost reads it, or a new post's seed.
export type PostEditorPost = Pick<PostWithAssets, 'text' | 'postedAt' | 'postAssets'> & {
  threadPosts: Pick<PostWithAssets, 'id' | 'text' | 'postAssets'>[];
};

// The post as the posts store takes it.
export type EditedPost = Required<Pick<PostFields, 'text' | 'assetRefs' | 'postedAt' | 'threadPosts'>>;

type PostEditorProps = {
  kind: PostEditorKind;
  ideas: IdeasKind;
  post: PostEditorPost;
  onSave: (post: EditedPost, seed: EditedPost) => Promise<unknown>;
};

type Draft = { cards: PostCardData[]; postedAt: EditedPost['postedAt']; pickedPostedAt: PickedPostedAt };

// Edits a post and its thread, seeded from `post` ({ text, postAssets, postedAt, threadPosts }), as a
// draft sheet: one card per post, the first post's on top, each following post's below it, joined by
// a short line. Add (a new post, `kind` 'draft') or Save (an edit) hands `onSave` the post the posts
// store takes ({ text, assetRefs, postedAt, threadPosts: [{ id, text, assetRefs }] }), allowed once
// every post has text or a photo (and, for Save, something changed), and the seed in the same shape,
// so an edit can save only what changed; a save that throws says so and keeps the editor open. A new
// post that opens empty has the cursor in its text, keyboard up. × or a swipe down with changes asks
// first. `kind` is also what the assistant's one chat for all the cards is about
// (chatSubjectKindSchema: 'draft' a new post, 'edit' a saved one), and `ideas` which ideas the first
// card's tray offers (Post ideas, Repost ideas), started on their own for a new post (useEditorIdeas);
// the card being edited shows the tray (IdeasTray), whose Use fills the card its turn wrote for.
export default function PostEditor({ kind, ideas, post, onSave }: PostEditorProps) {
  const nextKey = useRef(0);
  const newKey = () => `card-${nextKey.current++}`;
  const [cards, setCards] = useState(() => seedCards(post).map((card) => ({ ...card, key: newKey() })));
  // The Posted time the user picked: undefined while untouched, null once removed (postedAtToSave).
  const [pickedPostedAt, setPickedPostedAt] = useState<PickedPostedAt>(undefined);
  const [activeKey, setActiveKey] = useState(cards[0].key);
  // A new post that opens empty (New post's card) is there to be written: its text takes the cursor.
  const [isOpenedEmpty] = useState(() => kind === 'draft' && !hasCardContent(cards[0]));

  const postedAt = pickedPostedAt === undefined ? post.postedAt : pickedPostedAt;
  // A new post's time is now until the user picks one, and a removed one is none: till then the
  // toolbar shows only its clock.
  const isPostedAtShown = postedAt != null && (kind === 'edit' || pickedPostedAt !== undefined);

  const seed = useMemo(() => postData({ cards: seedCards(post), postedAt: post.postedAt }), [post]);

  const updateCard = useCallback((key: string, changes: PostCardChange) => {
    setCards((current) => current.map((card) => (card.key === key ? { ...card, ...changes } : card)));
    setActiveKey(key);
  }, []);
  const setText = useCallback((key: string, text: string) => updateCard(key, { text }), [updateCard]);
  // The cards as the chat takes them.
  const posts = useMemo(() => cards.map((card) => toChatDraftPost(card.key, card)), [cards]);
  const { sessionId, settings } = useEditorIdeas({ kind, ideas, posts, activeKey, setText });

  // The posts store syncs by itself.
  const { sheetProps } = useEditSheet({
    ...draftSheetOptions(kind, seed, { cards, postedAt, pickedPostedAt }, onSave),
    syncsItself: true,
  });

  function addToThread() {
    const key = newKey();
    setCards((current) => [...current, { key, id: null, text: '', postAssets: [] }]);
    setActiveKey(key);
  }

  async function removeCard(key: string) {
    const card = cards.find((c) => c.key === key);
    if (!card) throw new Error(`No card ${key}`);
    if (hasCardContent(card)) {
      const isConfirmed = await confirmAsync({
        title: 'Remove this post?',
        message: 'Its text and photos go with it.',
        action: 'Remove',
        destructive: true,
      });
      if (!isConfirmed) return;
    }
    setCards((current) => current.filter((c) => c.key !== key));
    if (activeKey === key) setActiveKey(cards[0].key);
  }

  return (
    <EditSheet testID="post-editor" {...sheetProps}>
      <View>
        {cards.map((card, index) => (
          <View key={card.key}>
            {index > 0 && <ThreadConnector />}
            <PostCard
              card={card}
              isFirst={index === 0}
              isActive={card.key === activeKey}
              autoFocus={index === 0 && isOpenedEmpty}
              postedAt={postedAt}
              isPostedAtShown={isPostedAtShown}
              onChangePostedAt={setPickedPostedAt}
              onChange={updateCard}
              onActivate={setActiveKey}
              onRemove={index > 0 ? removeCard : undefined}
              onAddToThread={index === cards.length - 1 ? addToThread : undefined}
              tray={
                card.key === activeKey && (
                  <IdeasTray
                    sessionId={sessionId}
                    target={card.key}
                    ideas={index === 0 ? ideas : null}
                    settings={settings}
                  />
                )
              }
            />
          </View>
        ))}
      </View>
    </EditSheet>
  );
}

// The editor's cards from the post it edits: the first post's, then one per following post.
function seedCards(post: PostEditorPost): PostCardContent[] {
  const first = { id: null, text: post.text, postAssets: post.postAssets };
  const following = post.threadPosts.map(({ id, text, postAssets }) => ({ id, text, postAssets }));
  return [first, ...following];
}

// What useEditSheet needs to know about the draft `current` of the post seeded as `seed` (postData).
// The save resolves an untouched Posted time (postedAtToSave): a new post's is the time of the save.
function draftSheetOptions(
  kind: PostEditorKind,
  seed: EditedPost,
  current: Draft,
  onSave: PostEditorProps['onSave'],
): Pick<EditSheetOptions, 'isNew' | 'isValid' | 'isDirty' | 'save'> {
  const isNew = kind === 'draft';
  const data = postData(current);
  return {
    isNew,
    isValid: current.cards.every(hasCardContent),
    isDirty: isPresent(changedValues(seed, data)),
    save: () => {
      const postedAt = postedAtToSave({
        isNew,
        picked: current.pickedPostedAt,
        seedPostedAt: seed.postedAt,
        now: getTimestamp(),
      });
      return onSave({ ...data, postedAt }, seed);
    },
  };
}

// The post as the posts store takes it.
function postData({
  cards: [first, ...following],
  postedAt,
}: Pick<Draft, 'postedAt'> & { cards: PostCardContent[] }): EditedPost {
  const { text, assetRefs } = partData(first);
  return { text, assetRefs, postedAt, threadPosts: following.map(partData) };
}

// One card as the posts store takes a post of the thread.
function partData({ id, text, postAssets }: PostCardContent): ThreadPart {
  return { id, text, assetRefs: postAssetsToAssetRefs(postAssets) };
}

// A post needs text or at least one photo.
function hasCardContent({ text, postAssets }: PostCardContent): boolean {
  return Boolean(text) || postAssets.length > 0;
}
