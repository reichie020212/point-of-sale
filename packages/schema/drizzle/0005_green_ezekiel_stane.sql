DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'cashier');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "region" ADD VALUE 'PH';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "currency" text DEFAULT 'PHP' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_rate" numeric(5, 3) DEFAULT '12.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'cashier' NOT NULL;