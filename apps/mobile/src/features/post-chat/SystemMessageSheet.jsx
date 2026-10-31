import BottomSheet from '@/components/BottomSheet';
import IntroText from '@/components/IntroText';

/**
 * The system prompt of the newest reply (`systemMessage`, the filled briefing the server
 * answers an ai_admin with), in a sheet to read or copy.
 */
export default function SystemMessageSheet({ isVisible, onClose, systemMessage }) {
  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="System prompt">
      <IntroText selectable>{systemMessage}</IntroText>
    </BottomSheet>
  );
}
