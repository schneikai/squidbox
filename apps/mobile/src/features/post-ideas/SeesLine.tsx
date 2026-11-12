import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import ChatSubjectLines from '@/features/post-chat/ChatSubjectLines';
import sentMentions from '@/features/post-chat/sentMentions';
import type { LiveChat } from '@/features/post-chat/useChatSession';
import useChatTags from '@/features/post-chat/useChatTags';
import useMentions from '@/features/post-chat/useMentions';
import useAssetAlbums from '@/hooks/useAssetAlbums';
import { space } from '@/styles/designTokens';

type SeesLineProps = {
  chat: Pick<LiveChat, 'assets' | 'tagEdits' | 'mentionEdits' | 'editTags' | 'editMentions'>;
};

/**
 * What the assistant goes on, under the tray's ideas while it is open: the chat card's lines
 * (ChatSubjectLines) in the assistant's quieter violet, a little apart, "Sees …" and "Mentions …", a tap editing them as on
 * the card, into the same chat (`chat`), so the next turn sends the edits. It reads the photos,
 * their albums and the mentions while the tray is there (folded too: the tray keeps its body), and
 * starts no tagging: a turn does.
 */
export default function SeesLine({ chat }: SeesLineProps) {
  const { assets, mentionEdits } = chat;
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useChatTags(assets);
  const found = useMentions(assetIds);
  const albums = useAssetAlbums({ assetIds }, { isLive: false });
  const mentions = useMemo(
    () => found && { handles: sentMentions(found, mentionEdits), fromAlbum: found.fromAlbum },
    [found, mentionEdits],
  );

  return (
    <View style={styles.lines}>
      <ChatSubjectLines
        assetIds={assetIds}
        albums={albums}
        tagging={tagging}
        mentions={mentions}
        chat={chat}
        tone="accentSoft"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  lines: {
    gap: space.xs,
  },
});
