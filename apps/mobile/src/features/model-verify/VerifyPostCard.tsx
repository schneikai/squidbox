import type { VerifyPost } from '@squidbox/shared';

import TagChips from './TagChips';

import Card from '@/components/Card';
import IntroText from '@/components/IntroText';
import Text from '@/components/Text';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

type VerifyPostCardProps = { post: VerifyPost };

/** The post a Verify conversation started with: its media and tagged people, its tags, its caption. */
export default function VerifyPostCard({ post }: VerifyPostCardProps) {
  const media = getAssetCountInfo({ photo: post.photos, video: post.videos });
  const people = post.mentions.length > 0 ? ` · tagged ${post.mentions.join(', ')}` : '';

  return (
    <Card padded>
      <Text variant="title" size="small">
        New post · {media}
        {people}
      </Text>
      {post.tags.length > 0 && <TagChips tags={post.tags} />}
      {post.caption ? <Text>{post.caption}</Text> : <IntroText>No caption yet</IntroText>}
    </Card>
  );
}
