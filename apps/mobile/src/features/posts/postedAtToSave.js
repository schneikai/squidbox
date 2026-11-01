/**
 * The Posted time a post editor saves. `picked` is the user's choice in the editor: undefined while
 * untouched, a timestamp, or null once they removed it (the post becomes a draft, "Not posted"). An
 * untouched new post (`isNew`) is posted now, at the save (`now`); an untouched edit keeps the time it
 * was seeded with (`seedPostedAt`).
 */
export default function postedAtToSave({ isNew, picked, seedPostedAt, now }) {
  if (picked !== undefined) return picked;
  return isNew ? now : seedPostedAt;
}
