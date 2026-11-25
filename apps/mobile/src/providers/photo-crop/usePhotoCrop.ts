import useRequiredContext from '@/hooks/useRequiredContext';
import PhotoCropContext, { type PhotoCropValue } from '@/providers/photo-crop/PhotoCropContext';

export default function usePhotoCrop(): PhotoCropValue {
  return useRequiredContext(PhotoCropContext, 'usePhotoCrop needs a PhotoCropProvider above it');
}
