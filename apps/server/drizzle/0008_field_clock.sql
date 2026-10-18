ALTER TABLE "album_assets" ADD COLUMN "field_clock" jsonb;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "field_clock" jsonb;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "field_clock" jsonb;--> statement-breakpoint
ALTER TABLE "post_assets" ADD COLUMN "field_clock" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "field_clock" jsonb;