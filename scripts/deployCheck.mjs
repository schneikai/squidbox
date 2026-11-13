import { FIRST_CONTRACT_VERSION } from './contractVersion.mjs';

/**
 * Whether the server at this checkout may deploy: docs/sync-design.md §15, Raising the minimum, step 4.
 * Pure; scripts/deployServer.mjs gathers the inputs.
 *
 * - `version`: the checkout's contract version (the first can raise nothing).
 * - `liveMinimum`: the deployed server's (`/up`), or null when it can't be read.
 * - `channels()`: read only when the proof is needed; per EAS channel `{ name, update, build }`: its
 *   latest finished build and the latest update for that build's runtime, as `{ commit, at, runtime }`
 *   (`at` in ms) or undefined; null when EAS can't be read. A channel without a build has no phones.
 *   Phones on the latest build run the newer of it and an update for its runtime; an update for
 *   another runtime never reaches them. Phones on older builds are told to install the latest one.
 * - `versionAt(commit)`: the contract version at a commit, or null when the commit can't be read.
 *
 * Returns the refusals, one sentence each; none when the deploy may go.
 */
export function deployRefusals({ version, liveMinimum, channels, versionAt }) {
  if (version === FIRST_CONTRACT_VERSION) return [];
  if (liveMinimum !== null && liveMinimum >= version) return [];
  const read = channels();
  if (read === null) {
    return [
      `This server raises the minimum contract version to ${version}, and EAS could not be read to check that the app with it is published on every channel. Nothing was deployed.`,
    ];
  }
  return read.flatMap(({ name, update, build }) => {
    if (!build) return [];
    const running = update && update.runtime === build.runtime && update.at > build.at ? update : build;
    const runs = versionAt(running.commit);
    if (runs === null) {
      return [
        `The ${name} channel runs commit ${running.commit}, which can't be read here to check its contract version: fetch it, then deploy again. Nothing was deployed.`,
      ];
    }
    if (runs >= version) return [];
    return [
      `The ${name} channel runs contract version ${runs} (${running.commit.slice(0, 8)}), below this server's ${version}: publish the app from the raise's commit first (docs/sync-design.md §15, Raising the minimum). Nothing was deployed.`,
    ];
  });
}
