module.exports = {
  root: true,
  extends: ['universe/native'],
  // React Native provides it (setUpXHR.js); universe/native doesn't list it.
  globals: { AbortController: 'readonly' },
};
