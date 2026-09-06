module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Use import alias to avoid relative paths when importing
      // Heads-Up: If you make changes here you need to run `npx expo start --clear`
      [
        'module-resolver',
        {
          // Anchor `@` to this package dir. module-resolver resolves relative aliases
          // against process.cwd() by default; under a monorepo a tool may run babel with
          // cwd = repo root, which would break `@`. `cwd: 'packagejson'` pins it to the
          // nearest package.json (apps/mobile).
          cwd: 'packagejson',
          alias: {
            '@': './src',
            // src: './src',
            // screens: './src/screens',
            // components: './src/components',
            // navigators: './src/navigators',
            // styles: './src/styles',
            // hooks: './src/hooks',
            // utils: './src/utils',
            // features: './src/features',
          },
        },
      ],
      // Inline .sql files as strings so Drizzle migrations can be bundled and applied on
      // device (drizzle-orm/expo-sqlite migrator). Pairs with metro.config.js sourceExts 'sql'.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
