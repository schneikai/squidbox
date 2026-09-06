import { use } from 'react';

import AlbumsContext from './AlbumsContext';

export default function useAlbums() {
  return use(AlbumsContext);
}
