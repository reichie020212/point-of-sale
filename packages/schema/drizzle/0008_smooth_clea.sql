DO $$ BEGIN
 CREATE TYPE "public"."loyalty_program_status" AS ENUM('active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."loyalty_target_type" AS ENUM('product', 'category');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_type" "loyalty_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"threshold" integer NOT NULL,
	"status" "loyalty_program_status" DEFAULT 'active' NOT NULL,
	"client_op_id" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"order_item_id" text,
	"is_redemption" boolean DEFAULT false NOT NULL,
	"client_op_id" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_punches" ADD CONSTRAINT "loyalty_punches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_punches" ADD CONSTRAINT "loyalty_punches_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_punches" ADD CONSTRAINT "loyalty_punches_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_programs_org_id_idx" ON "loyalty_programs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_programs_target_idx" ON "loyalty_programs" USING btree ("org_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_programs_org_version_idx" ON "loyalty_programs" USING btree ("org_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_programs_client_op_id_idx" ON "loyalty_programs" USING btree ("org_id","client_op_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_punches_org_id_idx" ON "loyalty_punches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_punches_customer_idx" ON "loyalty_punches" USING btree ("org_id","customer_id","program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_punches_program_idx" ON "loyalty_punches" USING btree ("org_id","program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_punches_org_version_idx" ON "loyalty_punches" USING btree ("org_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_punches_client_op_id_idx" ON "loyalty_punches" USING btree ("org_id","client_op_id");