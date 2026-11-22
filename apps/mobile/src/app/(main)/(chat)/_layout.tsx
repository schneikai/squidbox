import SheetStack from '@/components/sheet-route/SheetStack';

// The assistant's chat about a post (Chat on its tray). Opened from a post outside a sheet; inside
// one, the chat pushes inside that sheet.
export default function ChatLayout() {
  return <SheetStack />;
}
