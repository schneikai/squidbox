// Reading a profile screenshot for the New contact sheet (POST /ai/contact-from-screenshot): the
// user's Get info from screenshot instructions, their chosen vision model or the default one.
import type { ContactFromScreenshotResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { imageDataUrl, visionMessages } from './prompts.js';
import { contactFromScreenshotTask, runChosenModelTask } from './tasks.js';

/**
 * The name, handles and place the user's vision model reads in the screenshot, each empty when it
 * isn't there. 502 ai_unavailable when the model is gone or can't see photos, when Venice fails or
 * the reply isn't the contact's JSON (runChosenModelTask). `signal` stops the Venice call. The
 * screenshot is never stored.
 */
export async function readContactScreenshotAsync({
  db,
  user,
  image,
  signal,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  image: { base64: string; mimeType: string };
  signal?: AbortSignal;
}): Promise<ContactFromScreenshotResponse> {
  async function messagesAsync() {
    const instructions = await readInstructions(db, user);
    return visionMessages({
      prompt: instructions.contactScreenshot,
      imageDataUrl: imageDataUrl(image),
    });
  }
  return runChosenModelTask({
    db,
    user,
    kind: 'vision',
    task: contactFromScreenshotTask,
    messagesAsync: messagesAsync(),
    signal,
  });
}
