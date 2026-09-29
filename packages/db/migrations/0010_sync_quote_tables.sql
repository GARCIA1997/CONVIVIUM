-- "tables" es palabra clave de SQL: format('%I') no la entrecomilla y NULL::tables falla.
-- Se entrecomilla siempre el nombre de la tabla.
CREATE OR REPLACE FUNCTION apply_config_change(tbl text, op text, pk jsonb, data jsonb, silent boolean, origin uuid) RETURNS void AS $$
DECLARE
  qt text := '"' || replace(tbl, '"', '""') || '"';
  pkcols text;
  cond text;
  upd text;
BEGIN
  PERFORM set_config('convivium.sync_apply', CASE WHEN silent THEN '1' ELSE '0' END, true);
  PERFORM set_config('convivium.origin_device', COALESCE(origin::text, ''), true);
  SELECT string_agg(quote_ident(k), ','),
         string_agg(format('%1$I = (jsonb_populate_record(NULL::%2$s, %3$L::jsonb)).%1$I', k, qt, pk), ' AND ')
    INTO pkcols, cond
    FROM jsonb_object_keys(pk) AS k;
  IF op = 'delete' THEN
    EXECUTE format('DELETE FROM %s WHERE %s', qt, cond);
  ELSE
    SELECT string_agg(format('%1$I = EXCLUDED.%1$I', column_name), ', ')
      INTO upd
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl
       AND NOT (column_name = ANY (ARRAY(SELECT jsonb_object_keys(pk))));
    EXECUTE format('INSERT INTO %1$s SELECT * FROM jsonb_populate_record(NULL::%1$s, $1) ON CONFLICT (%2$s) DO %3$s',
                   qt, pkcols, CASE WHEN upd IS NULL THEN 'NOTHING' ELSE 'UPDATE SET ' || upd END)
      USING data;
  END IF;
  PERFORM set_config('convivium.sync_apply', '0', true);
  PERFORM set_config('convivium.origin_device', '', true);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION config_current_row(tbl text, pk jsonb) RETURNS jsonb AS $$
DECLARE
  qt text := '"' || replace(tbl, '"', '""') || '"';
  cond text;
  out jsonb;
BEGIN
  SELECT string_agg(format('%1$I = (jsonb_populate_record(NULL::%2$s, %3$L::jsonb)).%1$I', k, qt, pk), ' AND ') INTO cond FROM jsonb_object_keys(pk) AS k;
  EXECUTE format('SELECT to_jsonb(x) FROM %s x WHERE %s', qt, cond) INTO out;
  RETURN out;
END;
$$ LANGUAGE plpgsql STABLE;
