CREATE TABLE "album_assets" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"album_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "album_assets_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "post_assets" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"post_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "post_assets_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "album_assets" ADD CONSTRAINT "album_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_assets_user_seq_idx" ON "album_assets" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "album_assets_album_idx" ON "album_assets" USING btree ("user_id","album_id");--> statement-breakpoint
CREATE INDEX "post_assets_user_seq_idx" ON "post_assets" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "post_assets_post_idx" ON "post_assets" USING btree ("user_id","post_id");--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "assets";--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "post_history";--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "last_posted_at";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "post_history";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "last_posted_at";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "asset_refs";