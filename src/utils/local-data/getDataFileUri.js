import { DATA_DIRECTORY } from './constants';

export default function getDataFileUri(filename) {
  return `${DATA_DIRECTORY}${filename}`;
}
