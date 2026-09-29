-- Compras, proveedores y menús publicados se sincronizan como configuración (nube ↔ nodo, last-writer-wins):
-- se capturan tanto en el local como desde la nube.
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
    WHEN 'supplier_prices' THEN (SELECT tenant_id FROM suppliers WHERE id = (rec ->> 'supplier_id')::uuid)
    WHEN 'purchase_order_lines' THEN (SELECT tenant_id FROM purchase_orders WHERE id = (rec ->> 'purchase_order_id')::uuid)
  END);
  -- Borrado en cascada cuyo padre ya no existe: el borrado del padre ya quedó registrado.
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  b := CASE WHEN TG_TABLE_NAME = 'branches' THEN NULL ELSE (rec ->> 'branch_id')::uuid END;
  INSERT INTO config_changes (tenant_id, branch_id, table_name, pk, op, data, changed_at, origin_device, kind)
  VALUES (
    t, b, TG_TABLE_NAME, key,
    CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE rec END,
    clock_timestamp(),
    NULLIF(current_setting('convivium.origin_device', true), '')::uuid,
    CASE WHEN TG_TABLE_NAME = ANY (ARRAY['checks','order_items','payments','tips','discounts','approvals','cash_sessions','cash_counts','cash_movements','stock','stock_movements']) THEN 'ops' ELSE 'config' END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION config_row_tenant(tbl text, rec jsonb) RETURNS uuid AS $$
  SELECT COALESCE((rec ->> 'tenant_id')::uuid, CASE tbl
    WHEN 'tenants' THEN (rec ->> 'id')::uuid
    WHEN 'modifiers' THEN (SELECT tenant_id FROM modifier_groups WHERE id = (rec ->> 'group_id')::uuid)
    WHEN 'product_stations' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_modifier_groups' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_availability' THEN (SELECT tenant_id FROM branches WHERE id = (rec ->> 'branch_id')::uuid)
    WHEN 'user_roles' THEN (SELECT tenant_id FROM users WHERE id = (rec ->> 'user_id')::uuid)
    WHEN 'recipe_lines' THEN (SELECT tenant_id FROM recipes WHERE id = (rec ->> 'recipe_id')::uuid)
    WHEN 'supplier_prices' THEN (SELECT tenant_id FROM suppliers WHERE id = (rec ->> 'supplier_id')::uuid)
    WHEN 'purchase_order_lines' THEN (SELECT tenant_id FROM purchase_orders WHERE id = (rec ->> 'purchase_order_id')::uuid)
  END);
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
CREATE TRIGGER sync_suppliers AFTER INSERT OR UPDATE OR DELETE ON suppliers FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_supplier_prices AFTER INSERT OR UPDATE OR DELETE ON supplier_prices FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_purchase_order_lines AFTER INSERT OR UPDATE OR DELETE ON purchase_order_lines FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_receipts AFTER INSERT OR UPDATE OR DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_payables AFTER INSERT OR UPDATE OR DELETE ON payables FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_supplier_payments AFTER INSERT OR UPDATE OR DELETE ON supplier_payments FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_menu_publications AFTER INSERT OR UPDATE OR DELETE ON menu_publications FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
