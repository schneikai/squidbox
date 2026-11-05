import { requireOptionalNativeModule } from 'expo';

// Whether this build has expo-sharing's native module: builds from before it was added lack it.
const canShareFiles = requireOptionalNativeModule('ExpoSharing') !== null;

export default canShareFiles;
