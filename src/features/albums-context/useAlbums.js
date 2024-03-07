import { useContext } from 'react';

import AlbumsContext from './AlbumsContext';

export default function useAlbums() {
  return useContext(AlbumsContext);
}
