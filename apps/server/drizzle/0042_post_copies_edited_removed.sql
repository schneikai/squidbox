ALTER TABLE "post_copies" ADD COLUMN "edited_at" bigint;--> statement-breakpoint
ALTER TABLE "post_copies" ADD COLUMN "removed_at" bigint;--> statement-breakpoint
-- Every copy made before editedAt was composed by the user (+ opened the composer): it is the
-- channel's own copy, so it keeps showing its posts. The server_seq trigger gives each row a new seq,
-- so devices take the value on their next pull; the field has no clock and reads the row's updated_at.
UPDATE "post_copies" SET "edited_at" = "updated_at";
