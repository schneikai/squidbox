import { createContext } from 'react';

// A picture to crop: its file and its size in pixels, as the image picker gives them.
export type CropPhoto = { uri: string; width: number; height: number };

export type PhotoCropValue = {
  openPhotoCrop: (photo: CropPhoto) => Promise<string | null>;
  finishPhotoCrop: (uri: string | null) => void;
};

const PhotoCropContext = createContext<PhotoCropValue | null>(null);

export default PhotoCropContext;
