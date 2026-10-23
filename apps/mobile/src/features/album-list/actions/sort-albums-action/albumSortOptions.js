// The albums list's sort choices, for the sort menus. "Custom order" is the albums' own order (position).
export default [
  { key: 'createdAt:desc', label: 'Newest first' },
  { key: 'createdAt:asc', label: 'Oldest first' },
  { key: 'lastPostedAt:desc', label: 'Recently posted' },
  { key: 'lastPostedAt:asc', label: 'Not posted in a while' },
  { key: 'custom', label: 'Custom order' },
];
