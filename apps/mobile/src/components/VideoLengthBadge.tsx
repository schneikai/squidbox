import ThumbnailBadge from '@/components/ThumbnailBadge';
import formatVideoDuration from '@/utils/formatVideoDuration';

type VideoLengthBadgeProps = { duration: number | null | undefined };

// A video's length (`duration` in ms) in its tile's bottom right corner; nothing for a photo.
export default function VideoLengthBadge({ duration }: VideoLengthBadgeProps) {
  if (!duration) return null;
  return <ThumbnailBadge label={formatVideoDuration(duration)} corner="bottomRight" />;
}
