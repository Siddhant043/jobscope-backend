ALTER TABLE "jobs" DROP CONSTRAINT "jobs_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "status" text DEFAULT 'processing';--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;