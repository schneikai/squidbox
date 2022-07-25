module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          alias: {
            components: "./src/components",
            constants: "./src/constants",
            screens: "./src/screens",
            services: "./src/services",
            navigation: "./src/navigation",
            styles: "./src/styles",
            hooks: "./src/hooks",
            root: "./",
            // assets: "./assets",
            // modules: "./src/modules",
            // lib: "./src/lib",
            // types: "./src/types",
          },
        },
      ],
    ],
  };
};
