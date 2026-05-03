ALTER TABLE "billing_subscriptions" ADD COLUMN "last_event_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "last_event_at" timestamp with time zone;