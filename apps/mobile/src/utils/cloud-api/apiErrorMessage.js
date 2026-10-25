/** What went wrong with a server call: the server's `{ error: { message } }` when it sent one. */
export default function apiErrorMessage(error) {
  return error?.response?.data?.error?.message ?? error?.message ?? 'Something went wrong';
}
