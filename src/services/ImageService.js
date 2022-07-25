import { Image } from "react-native";

export function getImageDimensions(localUri) {
  return new Promise(function (resolve, reject) {
    Image.getSize(localUri, (width, height) => resolve([width, height]), reject);
  });
}
