import { Image } from 'react-native';

export default function getImageDimensionsAsync(imageUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      imageUri,
      (width, height) => {
        resolve({ width, height });
      },
      (error) => {
        reject(error);
      },
    );
  });
}
