// What each account feature is called and unlocks, as Settings → Features shows it, and the feature
// it needs to do anything (`requires`). manage_features is left out: it is the page itself, and
// only the server script changes it.
const featureText = {
  ai: {
    title: 'Assistant',
    description: 'Settings → Assistant: writing as you, favorites, prompt buttons and models.',
  },
  ai_admin: {
    title: 'AI admin',
    description: 'Compare models, their scores and the Venice balance.',
    requires: 'ai',
  },
};

export default featureText;
