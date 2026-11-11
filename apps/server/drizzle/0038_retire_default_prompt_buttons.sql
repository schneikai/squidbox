-- The default prompt buttons Caption and Repost ideas are retired: a new post's and a repost's ideas
-- are the user's idea settings now. A row still holding the shipped text is deleted, a tombstone
-- whose deletedAt clock is newer than every clock the row had (the other fields keep the ones they
-- had, as storedClocks reads them), so devices take it on their next pull; the server_seq trigger
-- gives the row a new seq. A row the user edited stays as a prompt button of theirs.
UPDATE "prompt_buttons" AS b SET
	"deleted_at" = c."reset_clock",
	"field_clock" = jsonb_build_object(
		'deletedAt', c."reset_clock",
		'name', c."name_clock",
		'prompt', c."prompt_clock",
		'placement', c."placement_clock",
		'icon', c."icon_clock",
		'position', c."position_clock"
	),
	"updated_at" = c."reset_clock"
FROM (
	SELECT
		k."user_id",
		k."id",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."name_clock", k."updated_at") END AS "name_clock",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."prompt_clock", k."updated_at") END AS "prompt_clock",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."placement_clock", k."updated_at") END AS "placement_clock",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."icon_clock", k."updated_at") END AS "icon_clock",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."position_clock", k."updated_at") END AS "position_clock",
		GREATEST(
			(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
			k."updated_at" + 1,
			coalesce(k."max_clock", 0) + 1
		) AS "reset_clock"
	FROM (
		SELECT
			j.*,
			j."max_clock" IS NULL OR j."updated_at" > j."max_clock" AS "legacy"
		FROM (
			SELECT
				"user_id",
				"id",
				"updated_at",
				("field_clock" ->> 'name')::bigint AS "name_clock",
				("field_clock" ->> 'prompt')::bigint AS "prompt_clock",
				("field_clock" ->> 'placement')::bigint AS "placement_clock",
				("field_clock" ->> 'icon')::bigint AS "icon_clock",
				("field_clock" ->> 'position')::bigint AS "position_clock",
				GREATEST(
					("field_clock" ->> 'deletedAt')::bigint,
					("field_clock" ->> 'name')::bigint,
					("field_clock" ->> 'prompt')::bigint,
					("field_clock" ->> 'placement')::bigint,
					("field_clock" ->> 'icon')::bigint,
					("field_clock" ->> 'position')::bigint
				) AS "max_clock"
			FROM "prompt_buttons"
			WHERE "deleted_at" IS NULL AND (
				("id" = 'e39b0935-7e63-4fd9-8e69-a2011c71edce' AND "prompt" = 'Write 3 captions for these photos. Short, one line each. Mention who''s in them when there''s a handle for it.')
				OR ("id" = '452726e1-35ae-463f-8cab-dcd19bba78df' AND "prompt" = 'Write 3 fresh posts that repost this for people who missed it. Same content, a new angle each time. Don''t repeat the original wording.')
			)
		) AS j
	) AS k
) AS c
WHERE b."user_id" = c."user_id" AND b."id" = c."id";
