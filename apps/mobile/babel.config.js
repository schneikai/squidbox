module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the worklets plugin Reanimated needs.
    presets: ['babel-preset-expo'],
    plugins: [
      // Inline .sql files as strings so Drizzle migrations can be bundled and applied on
      // device (drizzle-orm/expo-sqlite migrator). Pairs with metro.config.js sourceExts 'sql'.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
