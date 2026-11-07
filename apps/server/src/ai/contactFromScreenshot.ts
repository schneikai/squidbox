// Reading a profile screenshot for the New contact sheet (POST /ai/contact-from-screenshot): the
// user's From screenshot instructions, their chosen vision model or the default one.
import { imageDataUrl, type ContactRead } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { CONTACT_FIELDS_FORMAT, fillTemplate, visionMessages } from './prompts.js';
import { contactReadTask, runChosenModelTask } from './tasks.js';

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
}): Promise<ContactRead> {
  async function messagesAsync() {
    const instructions = await readInstructions(db, user);
    return visionMessages({
      prompt: fillTemplate(instructions.contactScreenshot, { fields: CONTACT_FIELDS_FORMAT }),
      imageDataUrl: imageDataUrl(image),
    });
  }
  return runChosenModelTask({
    db,
    user,
    kind: 'vision',
    task: contactReadTask,
    messagesAsync: messagesAsync(),
    signal,
  });
}
