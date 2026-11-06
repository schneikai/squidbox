import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';

type TagChipsProps = { tags: readonly string[] };

/** Tags as chips to read, not to tap: a Verify photo's answer, a Verify post's tags. */
export default function TagChips({ tags }: TagChipsProps) {
  return (
    <ChipRow>
      {tags.map((tag) => (
        <Chip key={tag} label={tag} />
      ))}
    </ChipRow>
  );
}
