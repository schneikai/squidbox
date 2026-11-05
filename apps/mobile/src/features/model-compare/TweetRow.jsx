import Button from '@/components/Button';
import Note from '@/components/Note';
import Text from '@/components/Text';

// A tweet a model wrote, with its thumbs up: `level` 0, 1 (a thumb up) or 2 (two, an outstanding
// one); `onToggle` steps it on, from two back to none.
export default function TweetRow({ text, level, onToggle }) {
  const isLiked = level > 0;
  return (
    <Note
      tone="muted"
      trailing={
        <Button
          icon="thumbs-up"
          variant="secondary"
          iconCount={level === 2 ? 2 : 1}
          isSelected={isLiked}
          filled={isLiked}
          onPress={onToggle}
          accessibilityLabel={LEVEL_LABELS[level]}
        />
      }
    >
      <Text selectable>{text}</Text>
    </Note>
  );
}

// What a tap does, for a screen reader.
const LEVEL_LABELS = ['Thumbs up', 'Two thumbs up', 'Remove thumbs up'];
