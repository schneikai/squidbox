/**
 * Whether the server at this checkout may deploy (docs/sync-design.md §15, Raising the minimum): a
 * server that raises the minimum contract version deploys only once every channel's phones run an
 * app with that version. Pure: scripts/deployServer.mjs gathers the inputs.
 *
 * - `version`: the checkout's contract version; 1 can raise nothing, so nothing is checked.
 * - `liveMinimum`: the deployed server's (`/up`), or null when it can't be read. One at least as high
 *   isn't a raise; a lower or unknown one needs the proof.
 * - `channels`: per EAS channel, `{ name, update, build }`, its latest update and latest finished
 *   build as `{ commit, at }` (ms) or undefined; null when EAS can't be read. A channel without a
 *   build has no phones and doesn't count. The newer of update and build is what phones run.
 * - `versionAt(commit)`: the contract version at a commit.
 *
 * Returns the refusals, one sentence each; none when the deploy may go.
 */
export function deployRefusals({ version, liveMinimum, channels, versionAt }) {
  if (version === 1) return [];
  if (liveMinimum !== null && liveMinimum >= version) return [];
  if (channels === null) {
    return [
      `This server raises the minimum contract version to ${version}, and EAS could not be read to check that the app with it is published on every channel. Nothing was deployed.`,
    ];
  }
  return channels.flatMap(({ name, update, build }) => {
    if (!build) return [];
    const running = update && update.at > build.at ? update : build;
    const runs = versionAt(running.commit);
    if (runs >= version) return [];
    return [
      `The ${name} channel runs contract version ${runs} (${running.commit.slice(0, 8)}), below this server's ${version}: publish the app from the raise's commit first (\`npm run ios:update\`, or \`npm run ios:app\` when native code or migrations changed). Nothing was deployed.`,
    ];
  });
}
