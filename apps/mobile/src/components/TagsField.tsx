import { uniqueTags } from '@squidbox/shared';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import TagInput from '@/components/TagInput';
import unguarded, { type GuardPress } from '@/lib/unguarded';
import { colors, layout, space, textStyles } from '@/styles/designTokens';
import tagKey from '@/utils/tagKey';

// Tags on only some of the items (an album's photos), and what a tap on one does.
type MixedTags = { tags: readonly string[]; onPress: (tag: string) => void };

export type TagsFieldProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  itemName?: string;
  disabled?: boolean;
  guardPress?: GuardPress;
  isFlush?: boolean;
  mixed?: MixedTags;
};

/**
 * Tags as chips on a card, each with a × that takes it out; `isFlush` lays them on the page instead
 * (the secondary info under a photo, which has no cards). The dashed Add turns into an input that
 * adds a tag on return (and stays open for the next) and closes on blur, adding what it holds. A
 * tag that is already there (in any case) isn't added twice; there is room for `maxTags` (optional) of
 * `maxTagLength`. `itemName` names one for VoiceOver ("tag" by default).
 * `mixed` (optional) marks the tags on only some of the items: their chips are dashed (Chip's
 * `mixed`), and a tap on one, or typing it again in Add, calls `mixed.onPress` with it. Add is then
 * solid, so dashed means only "on some".
 * `disabled` shows the tags without taking changes (a mixed chip's tap included).
 * `guardPress(onPress)` (optional) wraps the chips' presses, so a parent can drop a touch that
 * dragged something else (useDetailsPanelDrag's); a return or a blur in the input isn't a press.
 */
function TagsField({
  tags,
  onChange,
  placeholder,
  maxTags = Infinity,
  maxTagLength,
  itemName = 'tag',
  disabled = false,
  guardPress = unguarded,
  isFlush = false,
  mixed,
}: TagsFieldProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const canAdd = !disabled && tags.length < maxTags;
  // Not rebuilt on every keystroke in the input.
  const mixedKeys = useMemo(() => new Set(mixed?.tags.map(tagKey)), [mixed?.tags]);

  function addTag() {
    // Cleared first, so the blur after a submit finds nothing left to add.
    setText('');
    const key = tagKey(text);
    const match = mixed?.tags.find((tag) => tagKey(tag) === key);
    if (mixed && match) {
      mixed.onPress(match);
      return;
    }
    const next = uniqueTags([...tags, text]);
    if (next.length === tags.length) return;
    onChange(next);
    // The last tag there's room for closes the input.
    if (next.length >= maxTags) setIsAdding(false);
  }

  function handleBlur() {
    addTag();
    setIsAdding(false);
  }

  const Surface = isFlush ? View : Card;
  return (
    <Surface style={[styles.field, !isFlush && styles.card]}>
      {tags.map((tag) => {
        const isMixed = !!mixed && mixedKeys.has(tagKey(tag));
        return (
          <Chip
            key={tag}
            label={tag}
            variant={isMixed ? 'mixed' : 'tag'}
            onPress={isMixed && !disabled ? guardPress(() => mixed.onPress(tag)) : undefined}
            onRemove={disabled ? undefined : guardPress(() => onChange(tags.filter((each) => each !== tag)))}
            removeLabel={`Remove ${tag}`}
          />
        );
      })}
      {isAdding && canAdd ? (
        <TagInput value={text} onChangeText={setText} onSubmit={addTag} onBlur={handleBlur} maxLength={maxTagLength} />
      ) : (
        canAdd && (
          <Chip
            label="Add"
            variant={mixed ? 'tag' : 'add'}
            icon={mixed ? 'add' : undefined}
            onPress={guardPress(() => setIsAdding(true))}
            accessibilityLabel={`Add a ${itemName}`}
          />
        )
      )}
      {tags.length === 0 && !isAdding && !!placeholder && <Text style={styles.placeholder}>{placeholder}</Text>}
    </Surface>
  );
}

export default memo(TagsField);

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  card: {
    padding: layout.objectInset,
  },
  placeholder: {
    ...textStyles.subheadline,
    color: colors.text.tertiary,
  },
});
