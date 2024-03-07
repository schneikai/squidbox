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
    ],
  };
};
