ALTER TABLE "assets" ADD COLUMN "purged_at" bigint;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "files_deleted_at" bigint;--> statement-breakpoint
CREATE INDEX "assets_purged_files_idx" ON "assets" USING btree ("user_id","id") WHERE "assets"."purged_at" is not null and "assets"."files_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_user_filename_idx" ON "assets" USING btree ("user_id","filename");--> statement-breakpoint
CREATE INDEX "assets_user_thumbnail_filename_idx" ON "assets" USING btree ("user_id","thumbnail_filename");