CREATE TYPE "public"."device_kind" AS ENUM('mesero', 'kds_tv', 'estacion_tactil', 'caja', 'admin', 'nodo');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('dueno', 'gerente', 'capitan', 'mesero', 'cajero', 'cocina', 'barra', 'almacenista');--> statement-breakpoint
CREATE TYPE "public"."reason_kind" AS ENUM('devolucion', 'cortesia', 'cancelacion', 'merma', 'descuento');--> statement-breakpoint
CREATE TYPE "public"."station_kind" AS ENUM('cocina', 'barra');--> statement-breakpoint
CREATE TYPE "public"."station_output" AS ENUM('pantalla', 'impresora', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."table_shape" AS ENUM('redonda', 'cuadrada', 'rectangular', 'periquera');--> statement-breakpoint
CREATE TYPE "public"."approval_kind" AS ENUM('cancelacion', 'devolucion_retiro', 'cortesia', 'descuento', 'reapertura');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pendiente', 'aprobada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."check_kind" AS ENUM('mesa', 'barra');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('abierta', 'pidio_cuenta', 'cobrada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."course" AS ENUM('entrada', 'fuerte', 'postre', 'bebida', 'sin_tiempo');--> statement-breakpoint
CREATE TYPE "public"."item_state" AS ENUM('pendiente', 'enviado', 'en_preparacion', 'listo', 'entregado', 'cancelado', 'devuelto');--> statement-breakpoint
CREATE TYPE "public"."item_priority" AS ENUM('normal', 'rehacer');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('efectivo_mxn', 'efectivo_usd', 'tarjeta', 'transferencia', 'vales');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('venta', 'merma', 'traspaso', 'ajuste', 'produccion', 'recepcion');--> statement-breakpoint
CREATE TYPE "public"."use_unit" AS ENUM('g', 'ml', 'pz');--> statement-breakpoint
CREATE TYPE "public"."payable_status" AS ENUM('pendiente', 'parcial', 'pagada');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('borrador', 'aprobada', 'enviada', 'recibida_parcial', 'recibida', 'cancelada');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"iva_pct" integer DEFAULT 16 NOT NULL,
	"usd_rate_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "device_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"station_id" uuid,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pairing_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rfc" text,
	"discount_caps" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	CONSTRAINT "user_roles_user_id_branch_id_role_pk" PRIMARY KEY("user_id","branch_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text,
	"pin_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_delta" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_availability" (
	"product_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sold_out" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_availability_product_id_branch_id_pk" PRIMARY KEY("product_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_modifier_groups" (
	"product_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "product_modifier_groups_product_id_group_id_pk" PRIMARY KEY("product_id","group_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_stations" (
	"product_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	CONSTRAINT "product_stations_product_id_station_id_pk" PRIMARY KEY("product_id","station_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"ieps_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"target_prep_sec" integer DEFAULT 900 NOT NULL,
	"photo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"sat_product_key" text,
	"sat_unit_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "reason_kind" NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "station_kind" NOT NULL,
	"output" "station_output" DEFAULT 'pantalla' NOT NULL,
	"printer_fallback" boolean DEFAULT true NOT NULL,
	"printer_address" text,
	"default_target_sec" integer DEFAULT 900 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"label" text NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"shape" "table_shape" DEFAULT 'cuadrada' NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"y" real DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"status" "approval_status" DEFAULT 'pendiente' NOT NULL,
	"check_id" uuid NOT NULL,
	"item_id" uuid,
	"amount" integer DEFAULT 0 NOT NULL,
	"pct" integer,
	"reason_id" uuid,
	"note" text,
	"payload" jsonb,
	"requested_by" uuid NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" "check_kind" NOT NULL,
	"table_id" uuid,
	"name" text,
	"guests" integer,
	"waiter_id" uuid NOT NULL,
	"status" "check_status" DEFAULT 'abierta' NOT NULL,
	"invoice_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"item_id" uuid,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason_id" uuid,
	"applied_by" uuid NOT NULL,
	"authorized_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"station_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"guest" integer,
	"course" "course" DEFAULT 'sin_tiempo' NOT NULL,
	"state" "item_state" DEFAULT 'pendiente' NOT NULL,
	"priority" "item_priority" DEFAULT 'normal' NOT NULL,
	"target_prep_sec" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"ready_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"expected" jsonb NOT NULL,
	"counted" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"opening_float" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" integer NOT NULL,
	"exchange_rate" integer,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"waiter_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purchase_unit" text NOT NULL,
	"use_unit" "use_unit" NOT NULL,
	"conversion" numeric(12, 4) NOT NULL,
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"max_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"avg_cost" integer DEFAULT 0 NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"lot_tracking" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid,
	"sub_recipe_id" uuid,
	"quantity" numeric(12, 3) NOT NULL,
	"waste_pct" numeric(5, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid,
	"modifier_id" uuid,
	"is_sub_recipe" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"yield_qty" numeric(12, 3),
	"steps" text[] DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"type" "movement_type" NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" integer,
	"reference_id" uuid,
	"reason_id" uuid,
	"lot" text,
	"expires_at" date,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"receipt_id" uuid,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"due_at" date NOT NULL,
	"status" "payable_status" DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "po_status" DEFAULT 'borrador' NOT NULL,
	"expected_at" date,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"invoice_folio" text,
	"cfdi_xml_url" text,
	"total" integer NOT NULL,
	"received_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payable_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"cash_session_id" uuid,
	"reference" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"unit_price" integer NOT NULL,
	"valid_from" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rfc" text,
	"phone" text,
	"email" text,
	"credit_days" integer DEFAULT 0 NOT NULL,
	"delivery_days" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"type" text NOT NULL,
	"actor_id" uuid,
	"authorized_by" uuid,
	"device_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" text,
	CONSTRAINT "events_id_unique" UNIQUE("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_availability" ADD CONSTRAINT "product_availability_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_stations" ADD CONSTRAINT "product_stations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_stations" ADD CONSTRAINT "product_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tables" ADD CONSTRAINT "tables_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discounts" ADD CONSTRAINT "discounts_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock" ADD CONSTRAINT "stock_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_payable_id_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
