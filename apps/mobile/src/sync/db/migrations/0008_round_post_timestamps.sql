-- "Postpone" on a repost suggestion saved a fractional suggest_repost_at before CreatePostScreen
-- rounded it, and the push now rejects a fractional timestamp. Round the posts' timestamps and
-- the post payloads waiting in the outbox, so their next push goes through.
UPDATE `posts` SET
  `created_at` = round(`created_at`),
  `updated_at` = round(`updated_at`),
  `deleted_at` = round(`deleted_at`),
  `posted_at` = round(`posted_at`),
  `suggest_repost_at` = round(`suggest_repost_at`)
WHERE 'real' IN (typeof(`created_at`), typeof(`updated_at`), typeof(`deleted_at`), typeof(`posted_at`), typeof(`suggest_repost_at`));
--> statement-breakpoint
UPDATE `outbox` SET
  `updated_at` = round(`updated_at`),
  `payload` = json_set(`payload`,
    '$.createdAt', CAST(round(json_extract(`payload`, '$.createdAt')) AS INTEGER),
    '$.updatedAt', CAST(round(json_extract(`payload`, '$.updatedAt')) AS INTEGER),
    '$.deletedAt', CAST(round(json_extract(`payload`, '$.deletedAt')) AS INTEGER),
    '$.postedAt', CAST(round(json_extract(`payload`, '$.postedAt')) AS INTEGER),
    '$.suggestRepostAt', CAST(round(json_extract(`payload`, '$.suggestRepostAt')) AS INTEGER))
WHERE `collection` = 'posts' AND 'real' IN (
  typeof(json_extract(`payload`, '$.createdAt')),
  typeof(json_extract(`payload`, '$.updatedAt')),
  typeof(json_extract(`payload`, '$.deletedAt')),
  typeof(json_extract(`payload`, '$.postedAt')),
  typeof(json_extract(`payload`, '$.suggestRepostAt'))
);
