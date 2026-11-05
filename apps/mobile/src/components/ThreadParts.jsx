import { View } from 'react-native';

import ThreadConnector from '@/components/ThreadConnector';

/**
 * A thread's following posts under its first one, each `renderPart(part)` joined to the one above by
 * the thread's line (the post screen, an unfolded thread in the posts list).
 */
export default function ThreadParts({ parts, renderPart }) {
  return parts.map((part) => (
    <View key={part.id}>
      <ThreadConnector />
      {renderPart(part)}
    </View>
  ));
}
