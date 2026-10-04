ALTER TABLE "branches" ADD COLUMN "idle_minutes_mesero" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "idle_minutes_caja" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "idle_minutes_estacion" integer DEFAULT 720 NOT NULL;