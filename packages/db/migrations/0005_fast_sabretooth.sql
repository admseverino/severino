ALTER TABLE "phone_verification_tokens" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verification_tokens" ADD COLUMN "code_digest" text NOT NULL;--> statement-breakpoint
CREATE INDEX "phone_verification_tokens_code_digest" ON "phone_verification_tokens" USING btree ("code_digest");