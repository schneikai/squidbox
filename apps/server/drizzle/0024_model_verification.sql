CREATE TABLE "model_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"turns_done" integer DEFAULT 0 NOT NULL,
	"turns_total" integer NOT NULL,
	"result" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "model_defaults" (
	"kind" text NOT NULL,
	"variant" text NOT NULL,
	"model_id" text NOT NULL,
	CONSTRAINT "model_defaults_kind_variant_pk" PRIMARY KEY("kind","variant")
);
--> statement-breakpoint
CREATE TABLE "verified_models" (
	"kind" text NOT NULL,
	"model_id" text NOT NULL,
	"unrestricted" boolean,
	"verified_by" uuid,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verified_models_kind_model_id_pk" PRIMARY KEY("kind","model_id")
);
--> statement-breakpoint
ALTER TABLE "instructions" ADD COLUMN "model_check_judge" text;--> statement-breakpoint
ALTER TABLE "model_checks" ADD CONSTRAINT "model_checks_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_defaults" ADD CONSTRAINT "model_defaults_kind_model_id_verified_models_kind_model_id_fk" FOREIGN KEY ("kind","model_id") REFERENCES "public"."verified_models"("kind","model_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_models" ADD CONSTRAINT "verified_models_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "model_checks_running_idx" ON "model_checks" USING btree ("kind","model_id") WHERE "model_checks"."status" = 'running';--> statement-breakpoint
CREATE INDEX "model_checks_latest_idx" ON "model_checks" USING btree ("kind","model_id","started_at" DESC NULLS LAST);--> statement-breakpoint
-- The verified models and the defaults the code held until now (VERIFIED_MODELS, DEFAULT_MODEL_IDS):
-- an ai_admin changes them in the app from here on. `unrestricted` overrides only where Venice
-- doesn't label the model itself (the abliterated one); the others follow Venice.
INSERT INTO "verified_models" ("kind", "model_id", "unrestricted") VALUES
	('writing', 'deepseek-v4-1-flash-uncensored', NULL),
	('writing', 'abliteration-abliterated-model-large-flash', true),
	('writing', 'claude-sonnet-5-5', NULL),
	('writing', 'kimi-k3', NULL),
	('writing', 'grok-4-7', NULL),
	('writing', 'openai-gpt-6-luna', NULL),
	('vision', 'gemma-4-uncensored', NULL);--> statement-breakpoint
INSERT INTO "model_defaults" ("kind", "variant", "model_id") VALUES
	('writing', 'regular', 'claude-sonnet-5-5'),
	('writing', 'unrestricted', 'deepseek-v4-1-flash-uncensored'),
	('vision', 'regular', 'gemma-4-uncensored'),
	('vision', 'unrestricted', 'gemma-4-uncensored');
