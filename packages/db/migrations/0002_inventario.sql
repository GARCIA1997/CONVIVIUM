CREATE TYPE "public"."count_status" AS ENUM('borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"theoretical" numeric(14, 3) NOT NULL,
	"counted" numeric(14, 3) NOT NULL,
	"unit_cost" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"status" "count_status" DEFAULT 'pendiente_aprobacion' NOT NULL,
	"counted_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "avg_cost" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "unit_cost" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "category" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."inventory_counts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouse_ingredient" UNIQUE("warehouse_id","ingredient_id");