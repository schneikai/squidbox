import { uniqueTags } from '@squidbox/shared';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import TagInput from '@/components/TagInput';
import { colors, typography } from '@/styles/designTokens';

/**
 * Tags as chips, a tap on one takes it out. The dashed Add turns into an input that adds a tag on
 * return (and stays open for the next) and closes on blur, adding what it holds. A tag that is
 * already there (in any case) isn't added twice; there is room for `maxTags` of `maxTagLength`.
 * `isDisabled` shows the tags without taking changes. `isBare` leaves out the card, for a field
 * inside one. `guardPress(onPress)` (optional) wraps the chips' presses, so a parent can drop a touch
 * that dragged something else (useDetailsPanelDrag's); a return or a blur in the input isn't a press.
 */
function TagsField({
  tags,
  onChange,
  placeholder,
  maxTags,
  maxTagLength,
  isDisabled = false,
  isBare = false,
  guardPress = unguarded,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const canAdd = !isDisabled && tags.length < maxTags;

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

  const Surface = isBare ? View : Card;

  return (
    <Surface style={isBare ? styles.bare : styles.card}>
      {tags.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          variant="accent"
          onPress={isDisabled ? undefined : guardPress(() => onChange(tags.filter((each) => each !== tag)))}
          accessibilityHint="Removes this tag"
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
            accessibilityLabel="Add a tag"
          />
        )
      )}
      {tags.length === 0 && !isAdding && <Text style={styles.placeholder}>{placeholder}</Text>}
    </Surface>
  );
}

export default memo(TagsField);

function unguarded(onPress) {
  return onPress;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  bare: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  placeholder: {
    fontSize: typography.subheadline,
    color: colors.text.tertiary,
  },
});
