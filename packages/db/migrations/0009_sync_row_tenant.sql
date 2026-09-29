-- Empresa a la que pertenece una fila de configuración (para validar lo que sube un nodo).
CREATE OR REPLACE FUNCTION config_row_tenant(tbl text, rec jsonb) RETURNS uuid AS $$
  SELECT COALESCE((rec ->> 'tenant_id')::uuid, CASE tbl
    WHEN 'tenants' THEN (rec ->> 'id')::uuid
    WHEN 'modifiers' THEN (SELECT tenant_id FROM modifier_groups WHERE id = (rec ->> 'group_id')::uuid)
    WHEN 'product_stations' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_modifier_groups' THEN (SELECT tenant_id FROM products WHERE id = (rec ->> 'product_id')::uuid)
    WHEN 'product_availability' THEN (SELECT tenant_id FROM branches WHERE id = (rec ->> 'branch_id')::uuid)
    WHEN 'user_roles' THEN (SELECT tenant_id FROM users WHERE id = (rec ->> 'user_id')::uuid)
    WHEN 'recipe_lines' THEN (SELECT tenant_id FROM recipes WHERE id = (rec ->> 'recipe_id')::uuid)
  END);
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
-- Fila actual (si existe) identificada por su llave primaria.
CREATE OR REPLACE FUNCTION config_current_row(tbl text, pk jsonb) RETURNS jsonb AS $$
DECLARE
  cond text;
  out jsonb;
BEGIN
  SELECT string_agg(format('%1$I = (jsonb_populate_record(NULL::%2$I, %3$L::jsonb)).%1$I', k, tbl, pk), ' AND ') INTO cond FROM jsonb_object_keys(pk) AS k;
  EXECUTE format('SELECT to_jsonb(x) FROM %I x WHERE %s', tbl, cond) INTO out;
  RETURN out;
END;
$$ LANGUAGE plpgsql STABLE;
