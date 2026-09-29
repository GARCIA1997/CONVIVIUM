CREATE TYPE "public"."fixture_kind" AS ENUM('muro', 'barra', 'puerta', 'estacion_servicio', 'ventanal', 'cocina');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "floor_fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"kind" "fixture_kind" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"y" real DEFAULT 0 NOT NULL,
	"w" real DEFAULT 120 NOT NULL,
	"h" real DEFAULT 16 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "rotation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "mergeable_with" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "assigned_user_id" uuid;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "joined_table_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "floor_fixtures" ADD CONSTRAINT "floor_fixtures_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
