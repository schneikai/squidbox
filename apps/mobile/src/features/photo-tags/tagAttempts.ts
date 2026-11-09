import createTagAttempts from '@/lib/createTagAttempts';

// The taggings that store tags on the photo (tagAssetAsync: Tag it, Tag again), so every screen
// shows one started anywhere. The post chat's taggings stay in the chat (chatTags).
const tagAttempts = createTagAttempts();

export default tagAttempts;
