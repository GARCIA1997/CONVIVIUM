ALTER TYPE "public"."check_kind" ADD VALUE 'llevar';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_publications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "badges" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "folio" integer;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "pickup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "disposables" boolean;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "handed_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "trade_name" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "categories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "min_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "active" boolean DEFAULT true NOT NULL;