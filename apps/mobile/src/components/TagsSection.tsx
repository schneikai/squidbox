import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import { space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

export type TagsSectionProps = {
  title: string;
  tagItLabel: string;
  onTagIt: () => void;
  isTagging: boolean;
  error: string | null;
  isFlush?: boolean;
  isFirst?: boolean;
  children: ReactNode;
};

/**
 * A section of tags (`children`, a TagsField) under its `title`, with the assistant's Tag it
 * (`tagItLabel`, spinning while `isTagging`) at the header's end while the assistant is available,
 * and the last tagging's `error` under the tags: a photo's details, an album's Tags sheet.
 * `isFlush` and `isFirst` are ScreenSectionHeader's.
 */
export default function TagsSection({
  title,
  tagItLabel,
  onTagIt,
  isTagging,
  error,
  isFlush = false,
  isFirst = false,
  children,
}: TagsSectionProps) {
  const isAssistantAvailable = useIsAssistantAvailable();

  return (
    <View>
      <ScreenSectionHeader
        title={title}
        isFlush={isFlush}
        isFirst={isFirst}
        trailing={
          isAssistantAvailable && (
            <Button label={tagItLabel} icon="sparkle" size="small" onPress={onTagIt} loading={isTagging} />
          )
        }
      />
      <View style={styles.section}>
        {children}
        {!!error && <Text style={listTextStyles.subtitle}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
});
