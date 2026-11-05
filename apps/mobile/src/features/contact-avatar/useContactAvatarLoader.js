import { use } from 'react';

import ContactAvatarLoaderContext from './ContactAvatarLoaderContext';

export default function useContactAvatarLoader() {
  return use(ContactAvatarLoaderContext);
}
