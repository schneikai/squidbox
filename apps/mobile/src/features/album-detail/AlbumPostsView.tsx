import { useEffect } from 'react';

import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import { usePagedQuery } from '@/sync/usePagedQuery';

type AlbumPostsViewProps = {
  albumId: string;
  onCount: (count: number | undefined) => void;
  paddingTop: number;
  paddingBottom: number;
};

// The album's posts, read only while this tab shows; `onCount` gets their count for the header.
export default function AlbumPostsView({ albumId, onCount, paddingTop, paddingBottom }: AlbumPostsViewProps) {
  const { rows, count, loadMore } = usePagedQuery(postQuery({ scope: { albumId }, sort: 'postedAt:desc' }), 20);

  useEffect(() => onCount(count), [count]);

  return <PostList rows={rows} loadMore={loadMore} contentContainerStyle={{ paddingTop, paddingBottom }} />;
}
