CREATE TABLE "albums" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"name" text NOT NULL,
	"assets" jsonb NOT NULL,
	"is_favorite" boolean NOT NULL,
	"archived_at" bigint,
	"post_history" jsonb NOT NULL,
	"last_posted_at" bigint,
	"show_in_post_suggestions_after" bigint,
	"old_collection_name" text,
	"notes" text,
	"sort_order" text,
	"smart_album_type" text,
	CONSTRAINT "albums_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"text" text NOT NULL,
	"asset_refs" jsonb NOT NULL,
	"is_favorite" boolean NOT NULL,
	"posted_at" bigint,
	"re_post_id" text,
	"is_ignored_for_repost" boolean NOT NULL,
	"suggest_repost_at" bigint NOT NULL,
	"has_been_reposted" boolean NOT NULL,
	CONSTRAINT "posts_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "albums_user_seq_idx" ON "albums" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "posts_user_seq_idx" ON "posts" USING btree ("user_id","server_seq");