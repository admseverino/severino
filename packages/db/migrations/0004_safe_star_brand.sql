CREATE TABLE "phone_verification_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"phone_e164" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"whatsapp_message_id" text NOT NULL,
	"text_body" text,
	"wa_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_e164" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "phone_verification_tokens" ADD CONSTRAINT "phone_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_whatsapp_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("whatsapp_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_verification_tokens_user_id" ON "phone_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_messages_whatsapp_message_id" ON "user_messages" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE INDEX "user_messages_user_ts" ON "user_messages" USING btree ("user_id","wa_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_e164_verified" ON "users" USING btree ("phone_e164") WHERE "users"."phone_verified_at" is not null and "users"."phone_e164" is not null;