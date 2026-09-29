CREATE TYPE "public"."promo_kind" AS ENUM('dos_por_uno', 'porcentaje', 'precio_especial', 'combo');--> statement-breakpoint
CREATE TYPE "public"."promo_status" AS ENUM('activa', 'pausada', 'borrador');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "promo_kind" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"product_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"category_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"days" integer[] DEFAULT '{}'::int[] NOT NULL,
	"start_time" text,
	"end_time" text,
	"zones" text[] DEFAULT '{}'::text[] NOT NULL,
	"tolerance_min" integer DEFAULT 0 NOT NULL,
	"status" "promo_status" DEFAULT 'borrador' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "promo_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "promotion_id" uuid;