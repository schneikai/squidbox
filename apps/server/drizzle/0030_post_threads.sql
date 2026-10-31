ALTER TABLE "posts" ADD COLUMN "thread_root_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "thread_index" integer;