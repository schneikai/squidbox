import { initialKeys, type PushMutation } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { push } from '../sync/push.js';
import { uuidv5 } from './uuidv5.js';

// One-shot legacy JSON → new backend importer (Phase 4, server-side variant). Each legacy file
// is a map { [id]: entity } (yup shape). We map old → modern and feed the records through the
// normal push() path, so they're Zod-validated, LWW-upserted, and server_seq-stamped exactly
// like a client push — then the user's device pulls everything down on first login.
//
// Deviation from sync-design §11 (which ran the converter on one device): running it in the
// backend fits the clean-rewrite (no device converter UI) and reuses the tested engine.

type AnyRecord = Record<string, any>;

// Epoch-ms timestamps and byte sizes are stored as bigint/integer columns, but some legacy rows
// carry fractional values (e.g. updatedAt = 1723483345552.0393). Round them to valid integers.
function int(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function base(e: AnyRecord) {
  const deleted = e.deletedAt !== undefined ? e.deletedAt : e.isDeleted ? e.updatedAt : null;
  return {
    id: e.id,
    createdAt: int(e.createdAt),
    updatedAt: int(e.updatedAt),
    // legacy isDeleted boolean → modern deletedAt tombstone
    deletedAt: int(deleted),
  };
}

export function toModernAsset(a: AnyRecord): AnyRecord {
  return {
    ...base(a),
    mediaLibraryAssetId: a.mediaLibraryAssetId,
    mediaType: a.mediaType === 'image' ? 'photo' : a.mediaType,
    width: int(a.width),
    height: int(a.height),
    fileSize: int(a.fileSize),
    duration: a.duration ?? null, // doublePrecision — float is fine
    filename: a.filename,
    thumbnailFilename: a.thumbnailFilename,
    isFavorite: !!a.isFavorite,
    notes: a.notes ?? null,
    // postHistory / lastPostedAt are derived on-device — not imported.
    oldFileId: a.oldFileId ?? null,
    isFileSynced: !!a.isFileSynced,
    isThumbnailSynced: !!a.isThumbnailSynced,
    isSynced: !!a.isSynced,
    // syncError is per-device local-only — intentionally not carried over.
  };
}

export function toModernAlbum(a: AnyRecord): AnyRecord {
  return {
    ...base(a),
    name: a.name,
    isFavorite: !!a.isFavorite,
    archivedAt: int(a.archivedAt),
    showInPostSuggestionsAfter: int(a.showInPostSuggestionsAfter),
    oldCollectionName: a.oldCollectionName ?? null,
    notes: a.notes ?? null,
    sortOrder: a.sortOrder ?? null,
    smartAlbumType: a.smartAlbumType ?? null,
  };
}

export function toModernPost(p: AnyRecord): AnyRecord {
  return {
    ...base(p),
    text: p.text ?? '',
    isFavorite: !!p.isFavorite,
    postedAt: int(p.postedAt),
    rePostId: p.rePostId ?? null,
    isIgnoredForRepost: !!p.isIgnoredForRepost,
    suggestRepostAt: int(p.suggestRepostAt ?? p.createdAt),
    hasBeenReposted: !!p.hasBeenReposted,
  };
}

// Turn each album's ordered `assets` array into album_assets edge records. The array still exists
// on the (remapped) legacy album here; it moves to edges and is dropped from the parent.
function toAlbumAssetEdges(a: AnyRecord): AnyRecord[] {
  const assetIds: string[] = a.assets ?? [];
  const keys = initialKeys(assetIds.length);
  return assetIds.map((assetId, i) => ({
    id: uuidv5(`${a.id}:${assetId}`),
    createdAt: int(a.createdAt),
    updatedAt: int(a.updatedAt),
    deletedAt: base(a).deletedAt, // a deleted album tombstones its memberships too
    albumId: a.id,
    assetId,
    position: keys[i],
  }));
}

// Turn each post's ordered `assetRefs` ({id, assetId}) into post_assets edges, reusing the ref id.
function toPostAssetEdges(p: AnyRecord): AnyRecord[] {
  const refs: { id: string; assetId: string }[] = p.assetRefs ?? [];
  const keys = initialKeys(refs.length);
  return refs.map((ref, i) => ({
    id: ref.id,
    createdAt: int(p.createdAt),
    updatedAt: int(p.updatedAt),
    deletedAt: base(p).deletedAt,
    postId: p.id,
    assetId: ref.assetId,
    position: keys[i],
  }));
}

export interface LegacyData {
  assets?: Record<string, AnyRecord>;
  albums?: Record<string, AnyRecord>;
  posts?: Record<string, AnyRecord>;
}

export interface ImportResult {
  collection: string;
  applied: number;
  skipped: number;
  rejected: number;
  reasons: string[];
}

/** Import legacy maps for one user via the push path. Idempotent (LWW), so re-runs are safe. */
export async function importLegacy(db: Db, userId: string, data: LegacyData): Promise<ImportResult[]> {
  const albums = Object.values(data.albums ?? {});
  const posts = Object.values(data.posts ?? {});

  // Parents (arrays dropped by the mappers) + junction edges built from those arrays.
  const mutationsByCollection: Record<string, PushMutation[]> = {
    assets: Object.values(data.assets ?? {}).map((e) => ({ collection: 'assets', record: toModernAsset(e) })),
    albums: albums.map((e) => ({ collection: 'albums', record: toModernAlbum(e) })),
    posts: posts.map((e) => ({ collection: 'posts', record: toModernPost(e) })),
    album_assets: albums.flatMap((a) =>
      toAlbumAssetEdges(a).map((record) => ({ collection: 'album_assets', record }))
    ),
    post_assets: posts.flatMap((p) =>
      toPostAssetEdges(p).map((record) => ({ collection: 'post_assets', record }))
    ),
  };

  const results: ImportResult[] = [];
  for (const collection of ['assets', 'albums', 'posts', 'album_assets', 'post_assets']) {
    const mutations = mutationsByCollection[collection] ?? [];
    if (mutations.length === 0) {
      results.push({ collection, applied: 0, skipped: 0, rejected: 0, reasons: [] });
      continue;
    }
    const pushResults = await push(db, userId, mutations);
    const reasons = pushResults.filter((r) => r.status === 'rejected').map((r) => `${r.id}: ${r.reason ?? ''}`);
    results.push({
      collection,
      applied: pushResults.filter((r) => r.status === 'applied').length,
      skipped: pushResults.filter((r) => r.status === 'skipped-lww').length,
      rejected: reasons.length,
      reasons,
    });
  }
  return results;
}
