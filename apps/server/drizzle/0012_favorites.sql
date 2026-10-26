CREATE TABLE "favorites" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"text" text NOT NULL,
	"source" text,
	CONSTRAINT "favorites_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_user_seq_idx" ON "favorites" USING btree ("user_id","server_seq");--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "example_posts";