CREATE TABLE IF NOT EXISTS "config_changes" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"table_name" text NOT NULL,
	"pk" jsonb NOT NULL,
	"op" text NOT NULL,
	"data" jsonb,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin_device" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
