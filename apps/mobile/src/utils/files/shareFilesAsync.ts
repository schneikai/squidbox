import { requireNativeModule } from 'expo';

// A file for the share sheet: its local uri (a URL on web) and the name it goes by.
export type ShareFile = { uri: string; filename: string };

// Opens the system share sheet with every file at once and resolves when it closes, whatever was
// picked; a failure rejects. Only where canShareFiles: the module throws on load in a build without it.
export default async function shareFilesAsync(files: readonly ShareFile[]): Promise<void> {
  const ShareFiles = requireNativeModule<{ shareAsync(uris: string[]): Promise<void> }>('ShareFiles');
  await ShareFiles.shareAsync(files.map((file) => file.uri));
}
