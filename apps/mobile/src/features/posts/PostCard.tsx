import type { AssetRecord, Channel } from '@squidbox/shared';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import PostCardToolbar, { type PostCardToolbarProps } from './PostCardToolbar';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Text from '@/components/Text';
import textLimit from '@/features/channels/textLimit';
import type { EditorPostAsset } from '@/features/post-assets-editor/PostAsset';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import MentionTextInput from '@/features/post-mentions/MentionTextInput';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import textForChannel from '@/features/post-mentions/textForChannel';
import type { Point } from '@/lib/Point';
import isPastTapSlop from '@/lib/isPastTapSlop';
import { layout, scale, space } from '@/styles/designTokens';
import type { ThreadPart } from '@/sync/postThreads';
import buildPostAssets from '@/utils/posts/buildPostAssets';

// What a card holds: one post of the thread, with its assets as the editor's strip holds them.
export type PostCardContent = Pick<ThreadPart, 'id' | 'text' | 'mentions'> & { postAssets: EditorPostAsset[] };

export type PostCardData = PostCardContent & { key: string };

// What a card reports changed to the editor.
export type PostCardChange = Partial<Pick<PostCardData, 'text' | 'mentions' | 'postAssets'>>;

type PostCardProps = {
  card: PostCardData;
  isFirst: boolean;
  isActive: boolean;
  autoFocus?: boolean;
  onChange: (key: string, changes: PostCardChange) => void;
  onActivate: (key: string) => void;
  onRemove?: (key: string) => void;
  // The assistant's tray under the toolbar (the card being edited has it), placed by `style`: on the
  // card's layout only when it shows, so a card without one has no room left under its toolbar.
  tray?: (style: StyleProp<ViewStyle>) => ReactNode;
  // The channel a copy is for, whose limits the card follows and whose handles its chips show.
  channel?: Pick<Channel, 'maxTextLength' | 'maxMedia' | 'handleField'>;
  contactsById: ReadonlyMap<string, MentionContact>;
  onPressMention?: (contactId: string) => void;
} & Pick<PostCardToolbarProps, 'postedAt' | 'isPostedAtShown' | 'onChangePostedAt' | 'onAddToThread'>;

/**
 * One post of the post editor (`card`: { key, text, mentions, postAssets }): its text with its
 * mentions as chips (MentionTextInput: while it `isActive`, typing @ lists the contacts of
 * `contactsById` and a tap puts the contact's chip in; a tap on a chip goes to `onPressMention`), its
 * photos once it has any, the toolbar, and `tray` under it (the assistant's, IdeasTray). `autoFocus` puts the cursor in its text as it opens. `onChange(key,
 * changes)` and `onActivate(key)` report to the editor; the first card (`isFirst`) has the thread's
 * time (`postedAt`, as text once `isPostedAtShown`, `onChangePostedAt`), a following one ×
 * (`onRemove(key)`), the last ⊕ (`onAddToThread`). A tap anywhere on the card makes it the one
 * being edited (its tray shows), without the keyboard. With `channel` (a copy's) the text's counter
 * ("260 / 280", the text as the channel gets it: textForChannel) follows the text, at its right, while its text is typed in, or while the text is
 * over; the counter and the media line turn red over a limit.
 */
export default function PostCard({
  card,
  isFirst,
  isActive,
  autoFocus = false,
  postedAt,
  isPostedAtShown,
  onChangePostedAt,
  onChange,
  onActivate,
  onRemove,
  onAddToThread,
  tray,
  channel,
  contactsById,
  onPressMention,
}: PostCardProps) {
  const { key, text, mentions, postAssets } = card;
  // Where a touch on the card began: a tap anywhere on it (a touch that ends near there, so scrolling
  // the editor past it doesn't count) makes it the one being edited.
  const touchStartRef = useRef<Point | null>(null);
  // While its text is being typed in: the counter shows only then (or once the text is over).
  const [isTyping, setIsTyping] = useState(false);
  const assetIds = useMemo(() => postAssets.map((postAsset) => postAsset.asset.id), [postAssets]);

  // The first card leaves room to write until photos come in under the text.
  const isRoomy = isFirst && postAssets.length === 0;

  const sentText = useMemo(
    () => (channel ? textForChannel({ text, mentions }, contactsById, channel).text : text),
    [channel, contactsById, mentions, text],
  );
  const { counter, isOver } = textLimit(channel, sentText);
  // The date's look beside it (Text `status`: regular, grey), so the toolbar has one grey.
  const counterNode = counter && (isTyping || isOver) && (
    <Text variant="status" tone={isOver ? 'danger' : undefined} style={styles.counter}>
      {counter}
    </Text>
  );

  function activate() {
    onActivate(key);
  }

  function handleFocus() {
    setIsTyping(true);
    activate();
  }

  function handleTouchStart({ nativeEvent }: GestureResponderEvent) {
    touchStartRef.current = { x: nativeEvent.pageX, y: nativeEvent.pageY };
  }
  function handleTouchEnd({ nativeEvent }: GestureResponderEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start && !isPastTapSlop(start, nativeEvent.pageX, nativeEvent.pageY)) activate();
  }

  function addPostAssets(assets: AssetRecord[]) {
    onChange(key, { postAssets: [...postAssets, ...buildPostAssets(assets)] });
  }

  return (
    // Touches, not a press: they take nothing from the controls, the photos' drag or the tray's swipe.
    <Card
      padded
      hasControlRow
      onTouchStart={isActive ? undefined : handleTouchStart}
      onTouchEnd={isActive ? undefined : handleTouchEnd}
      onTouchCancel={() => (touchStartRef.current = null)}
    >
      <View style={styles.top}>
        <MentionTextInput
          value={{ text, mentions }}
          onChange={(value) => onChange(key, value)}
          channel={channel}
          contactsById={contactsById}
          placeholder="What's new?"
          minHeight={isRoomy ? scale(84) : scale(48)}
          autoFocus={autoFocus}
          isActive={isActive}
          assetIds={assetIds}
          onPressMention={onPressMention}
          onFocus={handleFocus}
          onBlur={() => setIsTyping(false)}
        />
        {onRemove && (
          <Button
            icon="close"
            size="small"
            accessibilityLabel="Remove this post"
            onPress={() => onRemove(key)}
            style={styles.remove}
          />
        )}
      </View>
      {counterNode}
      <PostAssetsEditor
        postAssets={postAssets}
        onChange={(value) => onChange(key, { postAssets: value })}
        channel={channel}
        style={styles.assets}
      />
      <PostCardToolbar
        isFirst={isFirst}
        exclude={assetIds}
        onAddMedia={addPostAssets}
        postedAt={postedAt}
        isPostedAtShown={isPostedAtShown}
        onChangePostedAt={onChangePostedAt}
        onAddToThread={onAddToThread}
        onActivate={activate}
      />
      {tray?.(styles.tray)}
    </Card>
  );
}

const styles = StyleSheet.create({
  // The × keeps its place when the text grows: the text takes the rest and wraps.
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // A card's gap from the text and the toolbar (the card's gap is the toolbar's slack).
  assets: {
    marginVertical: layout.cardGap - layout.controlRowSlack,
  },
  // The toolbar's 44 pt row already leaves room under its icons, so the tray follows at the card's
  // gap, and keeps the card's side inset below it.
  tray: {
    marginTop: layout.cardGap - layout.controlRowSlack,
    marginBottom: layout.cardInset - layout.controlRowSlack,
  },
  // Right under the text's end, where the eye is while typing.
  counter: {
    alignSelf: 'flex-end',
  },
  // The × lines up with the text's first line.
  remove: {
    flexShrink: 0,
    marginTop: -space.hair,
  },
});
