CREATE TABLE "contact_settings" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"pinned_list_id" text,
	"pinned_at" bigint,
	CONSTRAINT "contact_settings_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_settings_user_seq_idx" ON "contact_settings" USING btree ("user_id","server_seq");