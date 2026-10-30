import { StyleSheet, Text as RNText } from 'react-native';

import TagChips from './TagChips';

import Card from '@/components/Card';
import IntroText from '@/components/IntroText';
import Text from '@/components/Text';
import { colors, typography } from '@/styles/designTokens';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

/** The post a Verify conversation started with: its media and tagged people, its tags, its caption. */
export default function VerifyPostCard({ post }) {
  const media = getAssetCountInfo({ photo: post.photos, video: post.videos });
  const people = post.mentions.length > 0 ? ` · tagged ${post.mentions.join(', ')}` : '';

  return (
    <Card style={styles.card}>
      <RNText style={styles.title}>
        New post · {media}
        {people}
      </RNText>
      {post.tags.length > 0 && <TagChips tags={post.tags} />}
      {post.caption ? <Text>{post.caption}</Text> : <IntroText>No caption yet</IntroText>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
