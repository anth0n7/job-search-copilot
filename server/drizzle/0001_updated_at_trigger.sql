-- Hand-written: Drizzle's schema.ts can't describe triggers.
-- Sets updated_at on every UPDATE, so no query (or future route) can forget to do it.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER resumes_set_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
