ALTER TABLE "post_copies" ADD COLUMN "follows_post" boolean;--> statement-breakpoint
ALTER TABLE "post_copies" DROP COLUMN "edited_at";