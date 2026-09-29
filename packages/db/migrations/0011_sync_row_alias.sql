-- La tabla "tables" tiene una columna "x": to_jsonb(x) tomaba la columna, no la fila. Alias sin colisión.
CREATE OR REPLACE FUNCTION config_current_row(tbl text, pk jsonb) RETURNS jsonb AS $$
DECLARE
  qt text := '"' || replace(tbl, '"', '""') || '"';
  cond text;
  out jsonb;
BEGIN
  SELECT string_agg(format('%1$I = (jsonb_populate_record(NULL::%2$s, %3$L::jsonb)).%1$I', k, qt, pk), ' AND ') INTO cond FROM jsonb_object_keys(pk) AS k;
  EXECUTE format('SELECT to_jsonb(cfg_row) FROM %s cfg_row WHERE %s', qt, cond) INTO out;
  RETURN out;
END;
$$ LANGUAGE plpgsql STABLE;
