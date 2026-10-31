import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import PostCard from './PostCard';
import postedAtToSave from './postedAtToSave';

import EditSheet from '@/components/EditSheet';
import ThreadConnector from '@/components/ThreadConnector';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';
import isPresent from '@/utils/isPresent';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

// Edits a post and its thread, seeded from `post` ({ text, postAssets, postedAt, threadPosts }), as a
// draft sheet: one card per post, the first post's on top, each following post's below it, joined by
// a short line. Add (a new post, `kind` 'draft') or Save (an edit) hands `onSave` the post the posts
// store takes ({ text, assetRefs, postedAt, threadPosts: [{ id, text, assetRefs }] }), allowed once
// every post has text or a photo (and, for Save, something changed), and the seed in the same shape,
// so an edit can save only what changed; a save that throws says so and keeps the editor open. × or a
// swipe down with changes asks first. `kind` is also what each card's assistant chat is about
// (chatSubjectKindSchema: 'draft' a new post, 'edit' a saved one).
export default function PostEditor({ kind, post, navigation, onSave }) {
  const nextKey = useRef(0);
  const newKey = () => `card-${nextKey.current++}`;
  const [cards, setCards] = useState(() => seedCards(post).map((card) => ({ ...card, key: newKey() })));
  // The Posted time the user picked: undefined while untouched, null once removed (postedAtToSave).
  const [pickedPostedAt, setPickedPostedAt] = useState(undefined);
  const [activeKey, setActiveKey] = useState(cards[0].key);

  const postedAt = pickedPostedAt === undefined ? post.postedAt : pickedPostedAt;
  // A new post's time is now until the user picks one, and a removed one is none: till then the
  // toolbar shows only its clock.
  const isPostedAtShown = postedAt != null && (kind === 'edit' || pickedPostedAt !== undefined);

  const seed = useMemo(() => postData({ cards: seedCards(post), postedAt: post.postedAt }), [post]);

  const updateCard = useCallback((key, changes) => {
    setCards((current) => current.map((card) => (card.key === key ? { ...card, ...changes } : card)));
    setActiveKey(key);
  }, []);

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

  async function removeCard(key) {
    if (hasCardContent(cards.find((c) => c.key === key))) {
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
    <EditSheet {...sheetProps}>
      <View>
        {cards.map((card, index) => (
          <View key={card.key}>
            {index > 0 && <ThreadConnector />}
            <PostCard
              kind={kind}
              card={card}
              isFirst={index === 0}
              isActive={card.key === activeKey}
              postedAt={postedAt}
              isPostedAtShown={isPostedAtShown}
              onChangePostedAt={setPickedPostedAt}
              onChange={updateCard}
              onActivate={setActiveKey}
              onRemove={index > 0 ? removeCard : undefined}
              onAddToThread={index === cards.length - 1 ? addToThread : undefined}
              navigation={navigation}
            />
          </View>
        ))}
      </View>
    </EditSheet>
  );
}

// The editor's cards from the post it edits: the first post's, then one per following post.
function seedCards(post) {
  const first = { id: null, text: post.text, postAssets: post.postAssets };
  const following = post.threadPosts.map(({ id, text, postAssets }) => ({ id, text, postAssets }));
  return [first, ...following];
}

// What useEditSheet needs to know about the draft `current` of the post seeded as `seed` (postData).
// The save resolves an untouched Posted time (postedAtToSave): a new post's is the time of the save.
function draftSheetOptions(kind, seed, current, onSave) {
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
function postData({ cards: [first, ...following], postedAt }) {
  const { text, assetRefs } = partData(first);
  return { text, assetRefs, postedAt, threadPosts: following.map(partData) };
}

// One card as the posts store takes a post of the thread.
function partData({ id, text, postAssets }) {
  return { id, text, assetRefs: postAssetsToAssetRefs(postAssets) };
}

// A post needs text or at least one photo.
function hasCardContent({ text, postAssets }) {
  return Boolean(text) || postAssets.length > 0;
}
