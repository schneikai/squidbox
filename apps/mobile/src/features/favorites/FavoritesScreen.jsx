import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import FavoriteCard from './FavoriteCard';
import useRemoveWithUndo from './useRemoveWithUndo';

import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import IconButton from '@/components/IconButton';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import UndoBar from '@/components/UndoBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import { layout } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { readFavorites } from '@/sync/favoritesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Settings → Assistant → Favorites: the posts the assistant writes like, newest first. The heart
// unhearts one, with Undo; + adds one of your own posts; a tap opens one to edit. Reachable from
// anywhere (a root screen), so the chat opens it too.
export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const isAvailable = useLeaveWhenUnavailable();
  const favorites = useLiveQuery((db) => readFavorites(db), [schema.favorites]);
  const removal = useRemoveWithUndo(favorites);
  const paddingBottom = useFloatingPrimaryActionPadding();
  // The cards last shown, so one the Favorite screen deleted can stay in place for its Undo.
  const shownRef = useRef(new Map());
  shownRef.current = new Map((removal.list ?? []).map((favorite) => [favorite.id, favorite]));

  // The Favorite screen deleted one (`removedId`): its card stays, dimmed, with the Undo bar.
  const removedId = params?.removedId;
  useEffect(() => {
    if (!removedId) return;
    const favorite = shownRef.current.get(removedId);
    if (favorite) removal.showRemoved(favorite);
    navigation.setParams({ removedId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per removal the Favorite screen reports
  }, [removedId]);

  function handleOpen(favorite) {
    navigation.navigate('FavoriteScreen', { id: favorite.id });
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader
        title="Favorites"
        onBack={() => navigation.goBack()}
        menuSlot={
          <IconButton
            icon="add"
            onPress={() => navigation.navigate('FavoriteScreen')}
            accessibilityLabel="Add one of your posts"
          />
        }
      />
      <DetailScrollView contentContainerStyle={{ paddingBottom }}>
        <IntroText style={styles.intro}>
          Posts the assistant writes like: ones you hearted in the chat or added here. Unheart one to stop it learning
          from it.
        </IntroText>
        {removal.list?.length === 0 && (
          <EmptyState
            icon="heart"
            title="No favorites yet"
            subtitle="Heart a suggestion in the chat, or add one of your own posts with +"
          />
        )}
        <View style={styles.cards}>
          {removal.list?.map((favorite) => (
            <FavoriteCard
              key={favorite.id}
              favorite={favorite}
              isRemoved={favorite.id === removal.removedId}
              onOpen={handleOpen}
              onUnheart={removal.remove}
              onUndo={removal.undo}
            />
          ))}
        </View>
      </DetailScrollView>
      <UndoBar message="Removed from favorites" isVisible={removal.isUndoVisible} onUndo={removal.undo} />
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
  cards: {
    gap: 12,
  },
});
