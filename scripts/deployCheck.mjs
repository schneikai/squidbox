/**
 * Whether the server at this checkout may deploy: docs/sync-design.md §15, Raising the minimum, step 4.
 * Pure; scripts/deployServer.mjs gathers the inputs.
 *
 * - `version`: the checkout's contract version (1 can raise nothing).
 * - `liveMinimum`: the deployed server's (`/up`), or null when it can't be read.
 * - `channels()`: read only when the proof is needed; per EAS channel `{ name, update, build }`, its
 *   latest update and latest finished build as `{ commit, at }` (ms) or undefined; null when EAS
 *   can't be read. A channel without a build has no phones; the newer of update and build is what
 *   phones run.
 * - `versionAt(commit)`: the contract version at a commit.
 *
 * Returns the refusals, one sentence each; none when the deploy may go.
 */
export function deployRefusals({ version, liveMinimum, channels, versionAt }) {
  if (version === 1) return [];
  if (liveMinimum !== null && liveMinimum >= version) return [];
  const read = channels();
  if (read === null) {
    return [
      `This server raises the minimum contract version to ${version}, and EAS could not be read to check that the app with it is published on every channel. Nothing was deployed.`,
    ];
  }
  return read.flatMap(({ name, update, build }) => {
    if (!build) return [];
    const running = update && update.at > build.at ? update : build;
    const runs = versionAt(running.commit);
    if (runs >= version) return [];
    return [
      `The ${name} channel runs contract version ${runs} (${running.commit.slice(0, 8)}), below this server's ${version}: publish the app from the raise's commit first (docs/sync-design.md §15, Raising the minimum). Nothing was deployed.`,
    ];
  });
}
