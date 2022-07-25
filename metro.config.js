// This fixes: "While trying to resolve module `idb` from file" when
// using the Firebase SDK
// https://stackoverflow.com/questions/72158122/expo-firebase-authentication-while-trying-to-resolve-module-idb-from-file

const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push("cjs");

module.exports = defaultConfig;
