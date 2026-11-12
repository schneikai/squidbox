import { requireOptionalNativeModule } from 'expo';

// Whether this build has our ShareFiles native module (modules/share-files): builds from before it
// was added lack it, and Android has none yet.
const canShareFiles = requireOptionalNativeModule('ShareFiles') !== null;

export default canShareFiles;
