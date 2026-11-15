import type { Channel } from '@squidbox/shared';
import type { StyleProp, ViewStyle } from 'react-native';

import type { MentionTextValue } from './mentionParts';
import useCopyPostText from './useCopyPostText';

import CopyButton from '@/components/CopyButton';

type CopyPostTextButtonProps = {
  post: MentionTextValue;
  /** The channel a copy is for: its text is copied as that channel gets it, without asking. */
  channel?: Pick<Channel, 'id' | 'handleField'>;
  style?: StyleProp<ViewStyle>;
};

/** A post card's copy icon: it copies the card's text as a channel gets it (useCopyPostText). style is for layout only. */
export default function CopyPostTextButton({ post, channel, style }: CopyPostTextButtonProps) {
  const { copyPostText, sheet } = useCopyPostText();

  return (
    <>
      <CopyButton onCopy={() => copyPostText(post, channel)} style={style} />
      {sheet}
    </>
  );
}
