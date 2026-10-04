-- Folio de OC por sucursal (OC-<clave>-0001) con consecutivo único por sucursal.
-- Antes: count(*)+1 por restaurante, que repetía folios entre sucursales (cada nodo solo ve las suyas)
-- y entre nube y nodo.

-- 1) Clave corta de sucursal, derivada del nombre: "Sucursal Centro" → CEN; repetidas → CEN2, CEN3…
ALTER TABLE "branches" ADD COLUMN "code" text;--> statement-breakpoint
WITH base AS (
  SELECT id, tenant_id, created_at,
    COALESCE(NULLIF(upper(substr(regexp_replace(translate(regexp_replace(name, '^\s*sucursal\s+', '', 'i'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^A-Za-z0-9]', '', 'g'), 1, 3)), ''), 'SUC') AS c
  FROM branches
), numbered AS (
  SELECT id, c, row_number() OVER (PARTITION BY tenant_id, c ORDER BY created_at, id) AS n FROM base
)
UPDATE branches b SET code = CASE WHEN n.n = 1 THEN n.c ELSE n.c || n.n END FROM numbered n WHERE n.id = b.id;--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branches_tenant_code_uq" ON "branches" USING btree ("tenant_id","code");--> statement-breakpoint

-- 2) Consecutivo por sucursal de las OC existentes (se conserva el folio ya impreso).
ALTER TABLE "purchase_orders" ADD COLUMN "seq" integer;--> statement-breakpoint
UPDATE purchase_orders p SET seq = x.n
FROM (SELECT id, row_number() OVER (PARTITION BY branch_id ORDER BY created_at, id) AS n FROM purchase_orders) x
WHERE x.id = p.id;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_branch_seq_uq" ON "purchase_orders" USING btree ("branch_id","seq");
