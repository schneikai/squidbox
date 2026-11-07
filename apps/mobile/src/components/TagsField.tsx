import { uniqueTags } from '@squidbox/shared';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import TagInput from '@/components/TagInput';
import unguarded, { type GuardPress } from '@/lib/unguarded';
import { colors, layout, space, textStyles } from '@/styles/designTokens';

export type TagsFieldProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags: number;
  maxTagLength?: number;
  itemName?: string;
  disabled?: boolean;
  guardPress?: GuardPress;
  isFlush?: boolean;
};

/**
 * Tags as chips on a card, each with a × that takes it out; `isFlush` lays them on the page instead
 * (the secondary info under a photo, which has no cards). The dashed Add turns into an input that adds a tag on
 * return (and stays open for the next) and closes on blur, adding what it holds. A tag that is
 * already there (in any case) isn't added twice; there is room for `maxTags` of `maxTagLength`.
 * `itemName` names one for VoiceOver ("tag" by default).
 * `disabled` shows the tags without taking changes. `guardPress(onPress)` (optional) wraps the
 * chips' presses, so a parent can drop a touch that dragged something else (useDetailsPanelDrag's);
 * a return or a blur in the input isn't a press.
 */
function TagsField({
  tags,
  onChange,
  placeholder,
  maxTags,
  maxTagLength,
  itemName = 'tag',
  disabled = false,
  guardPress = unguarded,
  isFlush = false,
}: TagsFieldProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const canAdd = !disabled && tags.length < maxTags;

  function addTag() {
    const next = uniqueTags([...tags, text]);
    setText('');
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
      {tags.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          onRemove={disabled ? undefined : guardPress(() => onChange(tags.filter((each) => each !== tag)))}
          removeLabel={`Remove ${tag}`}
        />
      ))}
      {isAdding && canAdd ? (
        <TagInput value={text} onChangeText={setText} onSubmit={addTag} onBlur={handleBlur} maxLength={maxTagLength} />
      ) : (
        canAdd && (
          <Chip
            label="Add"
            variant="add"
            onPress={guardPress(() => setIsAdding(true))}
            accessibilityLabel={`Add a ${itemName}`}
          />
        )
      )}
      {tags.length === 0 && !isAdding && <Text style={styles.placeholder}>{placeholder}</Text>}
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
