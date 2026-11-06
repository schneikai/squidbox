import type { AssetMessageText } from './AssetMessage';

import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';

const MESSAGES: ReadonlyMap<string, AssetMessageText> = new Map(
  Object.entries(assetFileUnavailableMessages).map(([status, { icon, message }]): [string, AssetMessageText] => [
    status,
    { icon, text: message },
  ]),
);

// What the page says about a file that can't be had, for the `status` its lookup found (any other
// status, or none yet, says nothing).
export default function unavailableMessage(status: string | undefined): AssetMessageText | undefined {
  return status === undefined ? undefined : MESSAGES.get(status);
}
