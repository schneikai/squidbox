// What each account feature is called and unlocks, as Settings → Features shows it. manage_features
// is left out: it is the page itself, and only the server script changes it.
const featureText = {
  ai: {
    title: 'Assistant',
    description: 'Settings → Assistant: writing as you, favorites, prompt buttons and the models it uses.',
  },
  ai_admin: {
    title: 'AI admin',
    description: 'Compare models, their scores and the Venice balance.',
  },
};

export default featureText;
