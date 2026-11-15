CREATE TABLE "post_copies" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"post_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"sent_at" bigint,
	"posts" jsonb NOT NULL,
	CONSTRAINT "post_copies_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "mentions" jsonb;--> statement-breakpoint
ALTER TABLE "post_copies" ADD CONSTRAINT "post_copies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_copies_user_seq_idx" ON "post_copies" USING btree ("user_id","server_seq");