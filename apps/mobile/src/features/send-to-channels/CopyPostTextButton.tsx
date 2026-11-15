import type { Channel } from '@squidbox/shared';
import type { StyleProp, ViewStyle } from 'react-native';

import useCopyPostText from './useCopyPostText';

import CopyTextButton from '@/components/CopyTextButton';
import type { MentionTextValue } from '@/features/post-mentions/mentionParts';

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
      <CopyTextButton text={() => copyPostText([post], channel)} style={style} />
      {sheet}
    </>
  );
}
