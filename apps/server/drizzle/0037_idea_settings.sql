CREATE TABLE "idea_settings" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"post_ideas_on" boolean NOT NULL,
	"repost_ideas_on" boolean NOT NULL,
	"post_ideas_prompt" text,
	"repost_ideas_prompt" text,
	CONSTRAINT "idea_settings_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "instructions" ADD COLUMN "more_ideas" text;--> statement-breakpoint
ALTER TABLE "idea_settings" ADD CONSTRAINT "idea_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idea_settings_user_seq_idx" ON "idea_settings" USING btree ("user_id","server_seq");