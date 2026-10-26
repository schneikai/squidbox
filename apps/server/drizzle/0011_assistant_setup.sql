CREATE TABLE "personas" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"about_you" text NOT NULL,
	"content_tags" jsonb NOT NULL,
	"tone" text NOT NULL,
	"use_emoji" boolean NOT NULL,
	"rules" jsonb NOT NULL,
	"example_posts" jsonb NOT NULL,
	CONSTRAINT "personas_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "prompt_buttons" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"placement" text NOT NULL,
	"icon" text,
	"position" text NOT NULL,
	CONSTRAINT "prompt_buttons_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_buttons" ADD CONSTRAINT "prompt_buttons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personas_user_seq_idx" ON "personas" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "prompt_buttons_user_seq_idx" ON "prompt_buttons" USING btree ("user_id","server_seq");