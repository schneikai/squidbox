import { Fragment, type ReactNode } from 'react';

import ThreadConnector from '@/components/ThreadConnector';

export type ThreadPartsProps<Part extends { id: string }> = {
  parts: Part[];
  renderPart: (part: Part, index: number) => ReactNode;
  renderConnector?: (part: Part, index: number) => ReactNode;
};

/**
 * A thread's following posts under its first one, each `renderPart(part, index)` joined to the one
 * above by the thread's line (`renderConnector(part, index)`, ThreadConnector unless given), all
 * side by side in the parent, which lays them out (the post screen, an unfolded thread in the
 * posts list).
 */
export default function ThreadParts<Part extends { id: string }>({
  parts,
  renderPart,
  renderConnector = defaultConnector,
}: ThreadPartsProps<Part>) {
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
