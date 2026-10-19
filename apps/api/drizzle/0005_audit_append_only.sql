ALTER TABLE "audit_logs" ADD COLUMN "merchant_id" uuid;--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_idx" ON "audit_logs" USING btree ("merchant_id","id");--> statement-breakpoint
-- Añadido a mano (ADR-028): las tablas de solo inserción lo son también en la base de datos. Ni la
-- aplicación ni nadie con sus credenciales puede corregir o borrar una entrada. TRUNCATE (el seed
-- local) no dispara triggers de fila; en producción el rol de la aplicación no tiene ese permiso.
CREATE FUNCTION "forbid_append_only_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción (%)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_append_only_mutation"();--> statement-breakpoint
CREATE TRIGGER "user_consents_append_only" BEFORE UPDATE OR DELETE ON "user_consents"
  FOR EACH ROW EXECUTE FUNCTION "forbid_append_only_mutation"();
