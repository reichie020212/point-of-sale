ALTER TABLE "refunds" ADD COLUMN "client_op_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_client_op_id_idx" ON "refunds" USING btree ("org_id","client_op_id");