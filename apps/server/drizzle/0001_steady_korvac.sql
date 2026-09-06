CREATE TABLE "assets" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"media_library_asset_id" text NOT NULL,
	"media_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"file_size" bigint NOT NULL,
	"duration" double precision,
	"filename" text NOT NULL,
	"thumbnail_filename" text NOT NULL,
	"is_favorite" boolean NOT NULL,
	"notes" text,
	"post_history" jsonb NOT NULL,
	"last_posted_at" bigint,
	"old_file_id" text,
	"is_file_synced" boolean NOT NULL,
	"is_thumbnail_synced" boolean NOT NULL,
	"is_synced" boolean NOT NULL,
	CONSTRAINT "assets_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_seq_idx" ON "assets" USING btree ("user_id","server_seq");