// The web preview keeps no files, so a contact's photo can only be added in the app.
export default async function makeAvatarAsync(..._args: unknown[]): Promise<void> {
  throw new Error('Add a contact photo in the app on your phone.');
}
