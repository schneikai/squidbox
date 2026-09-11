import { describe, it, expect } from 'vitest';
import { remapLegacyIds } from '../src/convert/remap.js';
import { uuidv5 } from '../src/convert/uuidv5.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Legacy ids in the real backups are nanoid (20-char) or undashed-hex (32-char).
const A1 = '00OUzJLnUWv74dyIfcSn'; // nanoid
const A2 = '49d11bb32fa843ee9316847f4391334e'; // undashed hex
const AL1 = '0flr8qwdKYtrpI3iXCGt';
const P1 = '0Oycr0ni8202CQGIq1nN';
const GHOST = 'doesNotExistAnywhere'; // referenced but no record

function fixture() {
  return {
    assets: {
      [A1]: { id: A1, postHistory: [P1, GHOST] },
      [A2]: { id: A2, postHistory: [] },
    },
    albums: {
      [AL1]: { id: AL1, assets: [A1, A2, GHOST], postHistory: [P1] },
    },
    posts: {
      [P1]: {
        id: P1,
        assetRefs: [
          { id: 'ref-1', assetId: A1 },
          { id: 'ref-2', assetId: GHOST }, // dropped: asset missing
        ],
        rePostId: GHOST, // dropped: post missing
      },
    },
  };
}

describe('remapLegacyIds', () => {
  it('canonicalizes every id to a uuid and rewrites references in lockstep', () => {
    const { data, stats } = remapLegacyIds(fixture());

    const newA1 = uuidv5(A1);
    const newP1 = uuidv5(P1);
    const newAL1 = uuidv5(AL1);

    // Record keys and .id are canonical uuids and match the deterministic mapping.
    expect(Object.keys(data.assets!)).toContain(newA1);
    expect(data.assets![newA1].id).toBe(newA1);
    for (const id of [...Object.keys(data.assets!), ...Object.keys(data.albums!), ...Object.keys(data.posts!)]) {
      expect(id).toMatch(UUID_RE);
    }

    // References follow the same map.
    expect(data.albums![newAL1].assets).toEqual([uuidv5(A1), uuidv5(A2)]); // GHOST dropped
    expect(data.albums![newAL1].postHistory).toEqual([newP1]);
    expect(data.assets![newA1].postHistory).toEqual([newP1]); // GHOST dropped
    expect(data.posts![newP1].assetRefs).toEqual([{ id: uuidv5(`${P1}:ref-1`), assetId: newA1 }]);
    expect(data.posts![newP1].assetRefs[0].id).toMatch(UUID_RE);
    expect(data.posts![newP1].rePostId).toBeNull();

    // Dangling refs are counted.
    expect(stats.droppedAlbumAssetRefs).toBe(1);
    expect(stats.droppedAssetPostHistory).toBe(1);
    expect(stats.droppedPostAssetRefs).toBe(1);
    expect(stats.droppedRePostIds).toBe(1);
  });

  it('is deterministic — same input yields identical output ids (idempotent re-run)', () => {
    const a = remapLegacyIds(fixture());
    const b = remapLegacyIds(fixture());
    expect(Object.keys(a.data.assets!)).toEqual(Object.keys(b.data.assets!));
    expect(a.data.posts![uuidv5(P1)].assetRefs).toEqual(b.data.posts![uuidv5(P1)].assetRefs);
  });
});
