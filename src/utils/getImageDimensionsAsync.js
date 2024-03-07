import { Image } from 'react-native';

export default function getImageDimensionsAsync(imageUri) {
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
