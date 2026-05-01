CREATE TABLE IF NOT EXISTS "sync_idempotency" (
	"org_id" uuid NOT NULL,
	"client_op_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_idempotency_org_id_client_op_id_pk" PRIMARY KEY("org_id","client_op_id")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_idempotency" ADD CONSTRAINT "sync_idempotency_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_idempotency_processed_at_idx" ON "sync_idempotency" USING btree ("processed_at");