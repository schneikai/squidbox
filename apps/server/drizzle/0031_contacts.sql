CREATE TABLE "contact_links" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"contact_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "contact_links_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "contact_list_members" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"list_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "contact_list_members_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "contact_lists" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"name" text NOT NULL,
	"notes" text,
	"position" text,
	CONSTRAINT "contact_lists_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"server_seq" bigint,
	"field_clock" jsonb,
	"name" text NOT NULL,
	"is_favorite" boolean NOT NULL,
	"favorited_at" bigint,
	"notes" text,
	"x_handle" text,
	"bluesky_handle" text,
	"only_fans_handle" text,
	"jff_handle" text,
	"phone_number" text,
	"places" jsonb NOT NULL,
	"avatar_filename" text,
	CONSTRAINT "contacts_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "instructions" ADD COLUMN "contact_screenshot" text;--> statement-breakpoint
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_links_user_seq_idx" ON "contact_links" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "contact_list_members_user_seq_idx" ON "contact_list_members" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "contact_lists_user_seq_idx" ON "contact_lists" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "contacts_user_seq_idx" ON "contacts" USING btree ("user_id","server_seq");