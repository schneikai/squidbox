import type { AssetRecord, Channel } from '@squidbox/shared';
import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';

import PostCardToolbar, { type PostCardToolbarProps } from './PostCardToolbar';

import Button from '@/components/Button';
import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import { counterText, isTextOver } from '@/features/channels/channelLimits';
import type { EditorPostAsset } from '@/features/post-assets-editor/PostAsset';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import MentionSuggestions from '@/features/post-mentions/MentionSuggestions';
import useMentionAutocomplete from '@/features/post-mentions/useMentionAutocomplete';
import type { Point } from '@/lib/Point';
import isPastTapSlop from '@/lib/isPastTapSlop';
import { colors, layout, scale, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { ThreadPart } from '@/sync/postThreads';
import buildPostAssets from '@/utils/posts/buildPostAssets';

// What a card holds: one post of the thread, with its assets as the editor's strip holds them.
export type PostCardContent = Pick<ThreadPart, 'id' | 'text'> & { postAssets: EditorPostAsset[] };

export type PostCardData = PostCardContent & { key: string };

// What a card reports changed to the editor.
export type PostCardChange = Partial<Pick<PostCardData, 'text' | 'postAssets'>>;

type PostCardProps = {
  card: PostCardData;
  isFirst: boolean;
  isActive: boolean;
  autoFocus?: boolean;
  onChange: (key: string, changes: PostCardChange) => void;
  onActivate: (key: string) => void;
  onRemove?: (key: string) => void;
  // The assistant's tray under the toolbar (the card being edited has it).
  tray?: ReactNode;
  // The post's channel selector, on the first card (ChannelSelector).
  selector?: ReactNode;
  // The limits of the post's channel.
  limits?: Pick<Channel, 'maxTextLength' | 'maxMedia'>;
} & Partial<Pick<PostCardToolbarProps, 'postedAt' | 'isPostedAtShown' | 'onChangePostedAt'>> &
  Pick<PostCardToolbarProps, 'onAddToThread'>;

/**
 * One post of the post editor (`card`: { key, text, postAssets }): its text, the contacts an @handle
 * being typed may mean while it `isActive` (MentionSuggestions, a tap writes the handle), its photos
 * once it has any, the toolbar, and `tray` under it (the assistant's, IdeasTray). `autoFocus` puts the cursor in its text as it opens. `onChange(key,
 * changes)` and `onActivate(key)` report to the editor; the first card (`isFirst`) has the thread's
 * time (`postedAt`, as text once `isPostedAtShown`, `onChangePostedAt`), a following one ×
 * (`onRemove(key)`), the last ⊕ (`onAddToThread`). A tap anywhere on the card makes it the one
 * being edited (its tray shows), without the keyboard. `selector` (the first card's) sits in a row
 * above the text; with `limits` (its channel's) the text's counter ("45 / 280") ends that row, or a
 * following card's toolbar, and the counter and the media line turn red over a limit. A card without
 * the Posted time props has no Posted time (a channel's step).
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
  selector,
  limits,
}: PostCardProps) {
  const { key, text, postAssets } = card;
  // Where a touch on the card began: a tap anywhere on it (a touch that ends near there, so scrolling
  // the editor past it doesn't count) makes it the one being edited.
  const touchStartRef = useRef<Point | null>(null);
  const setText = useCallback((value: string) => onChange(key, { text: value }), [onChange, key]);
  const autocomplete = useMentionAutocomplete(text, setText);
  // The handle being typed in the card being edited, whose suggestions show.
  const mention = isActive ? autocomplete.mention : null;
  const assetIds = useMemo(() => postAssets.map((postAsset) => postAsset.asset.id), [postAssets]);

  // The first card leaves room to write until photos come in under the text, or the suggestions of a
  // handle being typed, which follow the text closely.
  const isRoomy = isFirst && postAssets.length === 0 && !mention;

  const counter = counterText(limits, text);
  const counterNode = counter && (
    <Text style={[listTextStyles.caption, isTextOver(limits, text) && styles.over]}>{counter}</Text>
  );
  const hasTopRow = isFirst && (!!selector || !!counterNode);

  function activate() {
    onActivate(key);
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
      {hasTopRow && (
        <View style={styles.selectorRow}>
          {selector}
          <View style={styles.counter}>{counterNode}</View>
        </View>
      )}
      <View style={styles.top}>
        <TextInput
          multiline
          placeholder="What's new?"
          minHeight={isRoomy ? scale(84) : scale(48)}
          autoFocus={autoFocus}
          onFocus={activate}
          value={text}
          {...autocomplete.inputProps}
          style={styles.text}
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
      {mention && <MentionSuggestions query={mention.query} assetIds={assetIds} onPick={autocomplete.pick} />}
      <PostAssetsEditor
        postAssets={postAssets}
        onChange={(value) => onChange(key, { postAssets: value })}
        maxCount={limits?.maxMedia}
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
        trailing={isFirst ? null : counterNode}
      />
      {tray && <View style={styles.tray}>{tray}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  // The channel selector and the counter, above the text.
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  counter: {
    marginLeft: 'auto',
    paddingLeft: space.sm,
  },
  over: {
    color: colors.status.danger,
  },
  // The × keeps its place when the text grows: the text takes the rest and wraps.
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    minWidth: 0,
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
  // The × lines up with the text's first line.
  remove: {
    flexShrink: 0,
    marginTop: -space.hair,
  },
});
