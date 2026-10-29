ALTER TABLE "model_checks" RENAME TO "verify_runs";--> statement-breakpoint
ALTER INDEX "model_checks_running_idx" RENAME TO "verify_runs_running_idx";--> statement-breakpoint
ALTER INDEX "model_checks_latest_idx" RENAME TO "verify_runs_latest_idx";--> statement-breakpoint
ALTER TABLE "verify_runs" RENAME CONSTRAINT "model_checks_pkey" TO "verify_runs_pkey";--> statement-breakpoint
ALTER TABLE "verify_runs" RENAME CONSTRAINT "model_checks_started_by_users_id_fk" TO "verify_runs_started_by_users_id_fk";--> statement-breakpoint
UPDATE "verify_runs" SET "status" = 'stopped' WHERE "status" = 'failed';--> statement-breakpoint
ALTER TABLE "instructions" RENAME COLUMN "model_check_judge" TO "verify_judge";
