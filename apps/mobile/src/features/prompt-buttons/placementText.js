// Where a prompt button shows, in the order the screens list them: each placement's title, and
// what the caption and Refine groups' footers say.
const placementText = {
  post: { title: 'On a post' },
  newPost: { title: 'On a new post' },
  caption: {
    title: 'Under the caption',
    footer:
      'Shown in the post editor once the caption has text. A tap puts the prompt and the caption in the chat, ready to send, so write it for one text: "Make this shorter".',
  },
  refine: {
    title: 'Refine',
    footer:
      'Shown under every reply in the chat. They change the options you just got, like making them shorter or funnier.',
  },
};

export const PLACEMENTS = Object.keys(placementText);

export default placementText;
