import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import PostablesList from './PostablesList';

import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import usePosts from '@/features/posts-context/usePosts';
import getTimestamp from '@/utils/date-time/getTimestamp';

export default function SuggestedPostables() {
  const { albums } = useAlbums();
  const { posts } = usePosts();

  const [repostables, setRepostables] = useState([]);

  useEffect(() => {
    // Only suggest albums that have never been posted and have a showInPostSuggestionsAfter
    // date that is not set or is in the past.
    const albumsFilterFn = (album) => {
      const currentTimestamp = getTimestamp();
      return album.lastPostedAt === null && (album.showInPostSuggestionsAfter || 0) < currentTimestamp;
    };

    const unpostedAlbums = prepareAlbums({
      albums: Object.values(albums),
      sortFn: (a, b) => b.createdAt - a.createdAt,
      // filterFn: (album) => album.lastPostedAt === null,
      filterFn: albumsFilterFn,
      showSmartAlbums: false,
    }).slice(0, 20);

    // TODO: Suggest posts that can be reposted.
    // Have to think about how to do this. We could add a repostedAt field to posts
    // and then only return posts that have either been reposted or created over a year ago.

    const repostables = unpostedAlbums.map((album) => ({ type: 'album', album }));
    setRepostables(repostables);
  }, [albums, posts]);

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Post Suggestions</Text>
      <PostablesList postables={repostables} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'lightgray',
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  headline: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
