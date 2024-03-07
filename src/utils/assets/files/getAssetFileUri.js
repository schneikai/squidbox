import { ASSET_FILE_PATH } from './constants';

export default function getAssetFileUri(filename) {
  return `${ASSET_FILE_PATH}${filename}`;
}
