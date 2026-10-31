import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import PostCard from './PostCard';

import EditSheet from '@/components/EditSheet';
import ThreadConnector from '@/components/ThreadConnector';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
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
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [activeKey, setActiveKey] = useState(cards[0].key);

  const updateCard = useCallback((key, changes) => {
    setCards((current) => current.map((card) => (card.key === key ? { ...card, ...changes } : card)));
    setActiveKey(key);
  }, []);

  // The posts store syncs by itself.
  const { sheetProps } = useEditSheet({
    ...draftSheetOptions(kind, post, { cards, postedAt }, onSave),
    syncsItself: true,
  });

  function addToThread() {
    const key = newKey();
    setCards((current) => [...current, { key, id: null, text: '', postAssets: [] }]);
    setActiveKey(key);
  }

  async function removeCard(key) {
    const card = cards.find((c) => c.key === key);
    if (card && hasCardContent(card)) {
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
              isActive={card.key === activeKey}
              isRinged={cards.length > 1 && card.key === activeKey}
              postedAt={index === 0 ? postedAt : undefined}
              onChangePostedAt={index === 0 ? setPostedAt : undefined}
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
  const following = (post.threadPosts ?? []).map(({ id, text, postAssets }) => ({ id, text, postAssets }));
  return [first, ...following];
}

// What useEditSheet needs to know about the draft `current` of `post`.
function draftSheetOptions(kind, post, current, onSave) {
  const seed = postData({ cards: seedCards(post), postedAt: post.postedAt });
  const data = postData(current);
  return {
    isNew: kind === 'draft',
    isValid: current.cards.every(hasCardContent),
    isDirty: isPresent(changedValues(seed, data)),
    save: () => onSave(data, seed),
  };
}

// The post as the posts store takes it.
function postData({ cards: [first, ...following], postedAt }) {
  return {
    text: first.text,
    assetRefs: postAssetsToAssetRefs(first.postAssets),
    postedAt,
    threadPosts: following.map(({ id, text, postAssets }) => ({
      id,
      text,
      assetRefs: postAssetsToAssetRefs(postAssets),
    })),
  };
}

// A post needs text or at least one photo.
function hasCardContent({ text, postAssets }) {
  return Boolean(text) || postAssets.length > 0;
}
