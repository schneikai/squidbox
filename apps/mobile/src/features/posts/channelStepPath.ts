/** The step that edits another channel of the post in the editor's sheet: `new`, or a draft's key. */
export default function channelStepPath(key: string): string {
  return `/post-editor-channel/${key}`;
}
