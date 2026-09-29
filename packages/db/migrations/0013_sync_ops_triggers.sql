-- Operación de la sucursal (ventas, caja, inventario) replicada del nodo a la nube para reportes
-- consolidados y comparación de sucursales (E9-06). Mismo registro, con kind = 'ops'; la nube nunca
-- los regresa a los nodos.
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
CREATE TRIGGER sync_checks AFTER INSERT OR UPDATE OR DELETE ON checks FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_order_items AFTER INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_payments AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_tips AFTER INSERT OR UPDATE OR DELETE ON tips FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_discounts AFTER INSERT OR UPDATE OR DELETE ON discounts FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_approvals AFTER INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_cash_sessions AFTER INSERT OR UPDATE OR DELETE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_cash_counts AFTER INSERT OR UPDATE OR DELETE ON cash_counts FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_cash_movements AFTER INSERT OR UPDATE OR DELETE ON cash_movements FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_stock AFTER INSERT OR UPDATE OR DELETE ON stock FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE TRIGGER sync_stock_movements AFTER INSERT OR UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION log_config_change('id');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS config_changes_kind_seq_idx ON config_changes (tenant_id, kind, seq);
