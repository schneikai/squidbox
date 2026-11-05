import AlbumsContext, { type AlbumsContextValue } from './AlbumsContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useAlbums(): AlbumsContextValue {
  return useRequiredContext(AlbumsContext, 'useAlbums needs an AlbumsProvider above it');
}
