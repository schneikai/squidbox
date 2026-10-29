// What each account feature is called and unlocks, as Settings → Features shows it, and the feature
// it needs to do anything (`requires`). developer is left out: it is the page itself, and
// only the server script changes it.
const featureText = {
  ai: {
    title: 'Assistant',
    description: 'Settings → Assistant: writing as you, favorites, prompt buttons and instructions.',
  },
  ai_admin: {
    title: 'AI admin',
    description:
      'Choose the models, compare them, verify them, set which are verified and the defaults, and see the Venice balance.',
    requires: 'ai',
  },
};

export default featureText;
