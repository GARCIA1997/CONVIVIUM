-- Bitácora inmutable (E1-06): prohíbe DELETE y cualquier UPDATE salvo marcar synced_at.
CREATE OR REPLACE FUNCTION events_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'events es inmutable';
  END IF;
  IF (to_jsonb(NEW) - 'synced_at') <> (to_jsonb(OLD) - 'synced_at') THEN
    RAISE EXCEPTION 'events es inmutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION events_immutable();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_tenant_seq_idx ON events (tenant_id, seq DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_unsynced_idx ON events (seq) WHERE synced_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS order_items_station_state_idx ON order_items (station_id, state);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS checks_branch_status_idx ON checks (branch_id, status);
