// Where a prompt button shows, in the order the screens list them: each placement's title, and
// what the Refine group's footer says.
const placementText = {
  post: { title: 'On a post' },
  newPost: { title: 'On a new post' },
  refine: {
    title: 'Refine',
    footer:
      'Shown under every reply in the chat. They change the options you just got, like making them shorter or funnier.',
  },
};

export const PLACEMENTS = Object.keys(placementText);

export default placementText;
