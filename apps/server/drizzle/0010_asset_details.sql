ALTER TABLE "assets" ADD COLUMN "favorited_at" bigint;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "taken_at" bigint;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "longitude" double precision;