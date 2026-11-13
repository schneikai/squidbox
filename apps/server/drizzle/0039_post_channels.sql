CREATE TABLE "channels" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"channel_id" text NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "channels_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "channel_root_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_user_seq_idx" ON "channels" USING btree ("user_id","server_seq");