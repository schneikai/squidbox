// What doesn't count as native code in the runtime version (app.config.js: runtimeVersion policy
// `fingerprint`). Setting sourceSkips replaces @expo/fingerprint's default skips, so they are kept
// and added to.
const { DEFAULT_SOURCE_SKIPS, SourceSkips } = require('@expo/fingerprint');

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    DEFAULT_SOURCE_SKIPS |
    // `extra` holds the commit and the profile, which differ between every build and update of the
    // same native code.
    SourceSkips.ExpoConfigExtraSection |
    // Version and build number are set remotely per build (eas.json: appVersionSource remote,
    // autoIncrement).
    SourceSkips.ExpoConfigVersions |
    // No script in package.json is a native build hook (no eas-build-*): a new one must not force a
    // build before the next update.
    SourceSkips.PackageJsonScriptsAll,
};
