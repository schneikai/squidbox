ALTER TABLE "instructions" DROP COLUMN "writing_format";--> statement-breakpoint
ALTER TABLE "instructions" DROP COLUMN "tags_system";--> statement-breakpoint
ALTER TABLE "instructions" DROP COLUMN "themes_context";--> statement-breakpoint
ALTER TABLE "instructions" DROP COLUMN "persona_framing";--> statement-breakpoint
ALTER TABLE "instructions" DROP COLUMN "chat_context";--> statement-breakpoint
-- Writing is now the whole briefing and Photo tags the whole tagging prompt, so a saved edit of the
-- old, shorter texts is reset to the default: a per-field write like any reset, its clock newer than
-- every clock the row had (deletedAt and moreLikeThis keep the ones they had, as storedClocks reads
-- them), so devices take it on their next pull; the server_seq trigger gives the row a new seq.
UPDATE "instructions" AS i SET
	"writing" = NULL,
	"vision_tagging" = NULL,
	"field_clock" = jsonb_build_object(
		'deletedAt', c."deleted_clock",
		'moreLikeThis', c."more_clock",
		'writing', c."reset_clock",
		'visionTagging', c."reset_clock"
	),
	"updated_at" = c."reset_clock"
FROM (
	SELECT
		k."user_id",
		k."id",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."deleted_at_clock", k."updated_at") END AS "deleted_clock",
		CASE WHEN k."legacy" THEN k."updated_at" ELSE coalesce(k."more_like_this_clock", k."updated_at") END AS "more_clock",
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
				("field_clock" ->> 'deletedAt')::bigint AS "deleted_at_clock",
				("field_clock" ->> 'moreLikeThis')::bigint AS "more_like_this_clock",
				GREATEST(
					("field_clock" ->> 'deletedAt')::bigint,
					("field_clock" ->> 'writing')::bigint,
					("field_clock" ->> 'visionTagging')::bigint,
					("field_clock" ->> 'moreLikeThis')::bigint
				) AS "max_clock"
			FROM "instructions"
			WHERE "writing" IS NOT NULL OR "vision_tagging" IS NOT NULL
		) AS j
	) AS k
) AS c
WHERE i."user_id" = c."user_id" AND i."id" = c."id";
