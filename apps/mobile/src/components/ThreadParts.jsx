import { Fragment } from 'react';

import ThreadConnector from '@/components/ThreadConnector';

/**
 * A thread's following posts under its first one, each `renderPart(part, index)` joined to the one
 * above by the thread's line (`renderConnector(part, index)`, ThreadConnector unless given), all
 * side by side in the parent, which lays them out (the post screen, an unfolded thread in the
 * posts list).
 */
export default function ThreadParts({ parts, renderPart, renderConnector = defaultConnector }) {
  return parts.map((part, index) => (
    <Fragment key={part.id}>
      {renderConnector(part, index)}
      {renderPart(part, index)}
    </Fragment>
  ));
}

function defaultConnector() {
  return <ThreadConnector />;
}
