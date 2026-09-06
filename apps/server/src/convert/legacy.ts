import type { PushMutation } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { push } from '../sync/push.js';

// One-shot legacy JSON → new backend importer (Phase 4, server-side variant). Each legacy file
// is a map { [id]: entity } (yup shape). We map old → modern and feed the records through the
// normal push() path, so they're Zod-validated, LWW-upserted, and server_seq-stamped exactly
// like a client push — then the user's device pulls everything down on first login.
//
// Deviation from sync-design §11 (which ran the converter on one device): running it in the
// backend fits the clean-rewrite (no device converter UI) and reuses the tested engine.

type AnyRecord = Record<string, any>;

function base(e: AnyRecord) {
  return {
    id: e.id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    // legacy isDeleted boolean → modern deletedAt tombstone
    deletedAt: e.deletedAt !== undefined ? e.deletedAt : e.isDeleted ? e.updatedAt : null,
  };
}

export function toModernAsset(a: AnyRecord): AnyRecord {
  return {
    ...base(a),
    mediaLibraryAssetId: a.mediaLibraryAssetId,
    mediaType: a.mediaType === 'image' ? 'photo' : a.mediaType,
    width: a.width,
    height: a.height,
    fileSize: a.fileSize,
    duration: a.duration ?? null,
    filename: a.filename,
    thumbnailFilename: a.thumbnailFilename,
    isFavorite: !!a.isFavorite,
    notes: a.notes ?? null,
    postHistory: a.postHistory ?? [],
    lastPostedAt: a.lastPostedAt ?? null,
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
    assets: a.assets ?? [],
    isFavorite: !!a.isFavorite,
    archivedAt: a.archivedAt ?? null,
    postHistory: a.postHistory ?? [],
    lastPostedAt: a.lastPostedAt ?? null,
    showInPostSuggestionsAfter: a.showInPostSuggestionsAfter ?? null,
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
    assetRefs: p.assetRefs ?? [],
    isFavorite: !!p.isFavorite,
    postedAt: p.postedAt ?? null,
    rePostId: p.rePostId ?? null,
    isIgnoredForRepost: !!p.isIgnoredForRepost,
    suggestRepostAt: p.suggestRepostAt ?? p.createdAt,
    hasBeenReposted: !!p.hasBeenReposted,
  };
}

const MAPPERS: Record<string, (e: AnyRecord) => AnyRecord> = {
  assets: toModernAsset,
  albums: toModernAlbum,
  posts: toModernPost,
};

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
  const results: ImportResult[] = [];
  for (const collection of ['assets', 'albums', 'posts'] as const) {
    const map = data[collection];
    if (!map) continue;
    const mutations: PushMutation[] = Object.values(map).map((e) => ({
      collection,
      record: MAPPERS[collection](e),
    }));
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
