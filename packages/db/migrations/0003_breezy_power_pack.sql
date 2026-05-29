CREATE TYPE "public"."whatsapp_message_type" AS ENUM('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts', 'button', 'interactive', 'reaction', 'order', 'system', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_processing_status" AS ENUM('received', 'handled', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "whatsapp_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"signature" text,
	"payload" jsonb NOT NULL,
	"raw_body" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"process_error" text,
	"process_attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"event_id" text NOT NULL,
	"wamid" text NOT NULL,
	"waba_id" text,
	"phone_number_id" text NOT NULL,
	"from_msisdn" text NOT NULL,
	"contact_name" text,
	"message_type" "whatsapp_message_type" NOT NULL,
	"text_body" text,
	"payload" jsonb NOT NULL,
	"wa_timestamp" timestamp with time zone NOT NULL,
	"status" "whatsapp_processing_status" DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_event_id_whatsapp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."whatsapp_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_events_received_at" ON "whatsapp_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "whatsapp_events_unprocessed" ON "whatsapp_events" USING btree ("received_at") WHERE "whatsapp_events"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_wamid" ON "whatsapp_messages" USING btree ("wamid");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_number_ts" ON "whatsapp_messages" USING btree ("phone_number_id","wa_timestamp");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_from_ts" ON "whatsapp_messages" USING btree ("from_msisdn","wa_timestamp");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_failed" ON "whatsapp_messages" USING btree ("status") WHERE "whatsapp_messages"."status" = 'failed';