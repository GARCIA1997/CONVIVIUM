-- Sincronización de configuración nube ↔ nodo (doc 05 §5).
-- 1) log_config_change(): trigger AFTER en cada tabla de configuración; registra upsert/delete en config_changes.
--    Si la sesión aplica cambios de sincronización (convivium.sync_apply = '1') no registra (sin eco).
--    TG_ARGV = columnas de la llave primaria.
CREATE OR REPLACE FUNCTION log_config_change() RETURNS trigger AS $$
DECLARE
  rec jsonb;
  key jsonb := '{}'::jsonb;
  col text;
  t uuid;
  b uuid;
BEGIN
  IF current_setting('convivium.sync_apply', true) = '1' THEN
    RETURN NULL;
  END IF;
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  FOREACH col IN ARRAY TG_ARGV LOOP
    key := key || jsonb_build_object(col, rec -> col);
  END LOOP;
  t := COALESCE((rec ->> 'tenant_id')::uuid, CASE TG_TABLE_NAME
    WHEN 'tenants' THEN (rec ->> 'id')::uuid
    WHEN 'modifiers' THEN (SELECT tenant_id FROM modifier_groups WHERE id = (rec ->> 'group_id')::uuid)
    WHEN 'product_stations' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_modifier_groups' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_availability' THEN (SELECT tenant_id FROM branches WHERE id = (rec ->> 'branch_id')::uuid)
    WHEN 'user_roles' THEN (SELECT tenant_id FROM users WHERE id = (rec ->> 'user_id')::uuid)
    WHEN 'recipe_lines' THEN (SELECT tenant_id FROM recipes WHERE id = (rec ->> 'recipe_id')::uuid)
  END);
  -- Borrado en cascada cuyo padre ya no existe: el borrado del padre ya quedó registrado.
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  b := CASE WHEN TG_TABLE_NAME = 'branches' THEN NULL ELSE (rec ->> 'branch_id')::uuid END;
  INSERT INTO config_changes (tenant_id, branch_id, table_name, pk, op, data, changed_at, origin_device)
  VALUES (
    t, b, TG_TABLE_NAME, key,
    CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE rec END,
    clock_timestamp(),
    NULLIF(current_setting('convivium.origin_device', true), '')::uuid
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- 2) apply_config_change(): aplica un cambio recibido (upsert por llave primaria o delete).
--    silent = true → no se registra (nodo aplicando lo que viene de la nube).
--    silent = false → sí se registra con origin_device (nube aplicando lo que sube un nodo, para
--    propagarlo a las demás sucursales sin regresárselo al que lo originó).
CREATE OR REPLACE FUNCTION apply_config_change(tbl text, op text, pk jsonb, data jsonb, silent boolean, origin uuid) RETURNS void AS $$
DECLARE
  pkcols text;
  cond text;
  upd text;
BEGIN
  PERFORM set_config('convivium.sync_apply', CASE WHEN silent THEN '1' ELSE '0' END, true);
  PERFORM set_config('convivium.origin_device', COALESCE(origin::text, ''), true);
  SELECT string_agg(quote_ident(k), ','),
         string_agg(format('%1$I = (jsonb_populate_record(NULL::%2$I, %3$L::jsonb)).%1$I', k, tbl, pk), ' AND ')
    INTO pkcols, cond
    FROM jsonb_object_keys(pk) AS k;
  IF op = 'delete' THEN
    EXECUTE format('DELETE FROM %I WHERE %s', tbl, cond);
  ELSE
    SELECT string_agg(format('%1$I = EXCLUDED.%1$I', column_name), ', ')
      INTO upd
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl
       AND NOT (column_name = ANY (ARRAY(SELECT jsonb_object_keys(pk))));
    EXECUTE format('INSERT INTO %1$I SELECT * FROM jsonb_populate_record(NULL::%1$I, $1) ON CONFLICT (%2$s) DO %3$s',
                   tbl, pkcols, CASE WHEN upd IS NULL THEN 'NOTHING' ELSE 'UPDATE SET ' || upd END)
      USING data;
  END IF;
  PERFORM set_config('convivium.sync_apply', '0', true);
  PERFORM set_config('convivium.origin_device', '', true);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER sync_tenants AFTER INSERT OR UPDATE OR DELETE ON tenants FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_branches AFTER INSERT OR UPDATE OR DELETE ON branches FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_user_roles AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION log_config_change('user_id', 'branch_id', 'role');
--> statement-breakpoint
CREATE TRIGGER sync_categories AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_stations AFTER INSERT OR UPDATE OR DELETE ON stations FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_product_stations AFTER INSERT OR UPDATE OR DELETE ON product_stations FOR EACH ROW EXECUTE FUNCTION log_config_change('product_id', 'station_id');
--> statement-breakpoint
CREATE TRIGGER sync_modifier_groups AFTER INSERT OR UPDATE OR DELETE ON modifier_groups FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_modifiers AFTER INSERT OR UPDATE OR DELETE ON modifiers FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_product_modifier_groups AFTER INSERT OR UPDATE OR DELETE ON product_modifier_groups FOR EACH ROW EXECUTE FUNCTION log_config_change('product_id', 'group_id');
--> statement-breakpoint
CREATE TRIGGER sync_product_availability AFTER INSERT OR UPDATE OR DELETE ON product_availability FOR EACH ROW EXECUTE FUNCTION log_config_change('product_id', 'branch_id');
--> statement-breakpoint
CREATE TRIGGER sync_promotions AFTER INSERT OR UPDATE OR DELETE ON promotions FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_reasons AFTER INSERT OR UPDATE OR DELETE ON reasons FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_areas AFTER INSERT OR UPDATE OR DELETE ON areas FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_tables AFTER INSERT OR UPDATE OR DELETE ON tables FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_floor_fixtures AFTER INSERT OR UPDATE OR DELETE ON floor_fixtures FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_warehouses AFTER INSERT OR UPDATE OR DELETE ON warehouses FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_ingredients AFTER INSERT OR UPDATE OR DELETE ON ingredients FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_recipes AFTER INSERT OR UPDATE OR DELETE ON recipes FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_recipe_lines AFTER INSERT OR UPDATE OR DELETE ON recipe_lines FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS config_changes_tenant_seq_idx ON config_changes (tenant_id, seq);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS config_changes_row_idx ON config_changes (table_name, pk);
