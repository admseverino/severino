CREATE TYPE "public"."missing_reading_default" AS ENUM('estimate', 'carry_over', 'extend');--> statement-breakpoint
CREATE TYPE "public"."group_kind" AS ENUM('floor', 'tower', 'block', 'villa_cluster', 'custom');--> statement-breakpoint
CREATE TYPE "public"."linked_meter_target_kind" AS ENUM('unit', 'group', 'condo');--> statement-breakpoint
CREATE TYPE "public"."meter_kind" AS ENUM('submeter', 'master');--> statement-breakpoint
CREATE TYPE "public"."meter_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."condo_role" AS ENUM('system_admin', 'multi_condo_admin', 'condo_admin', 'condo_operator', 'condo_editor');--> statement-breakpoint
CREATE TYPE "public"."period_state" AS ENUM('scheduled', 'reading_open', 'review', 'closed', 'billed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."reading_status" AS ENUM('pending', 'approved', 'rejected', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."consumption_kind" AS ENUM('unit', 'common_area');--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "oauth_accounts_provider_account_key" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "condo_config" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"condo_id" text NOT NULL,
	"logo_image" text,
	"reading_day" integer DEFAULT 1 NOT NULL,
	"reading_window_days" integer DEFAULT 7 NOT NULL,
	"review_sla_days" integer DEFAULT 7 NOT NULL,
	"billing_day" integer DEFAULT 15 NOT NULL,
	"delta_threshold_pct" numeric(8, 2) DEFAULT '300' NOT NULL,
	"ocr_confidence_floor" numeric(4, 3) DEFAULT '0.7' NOT NULL,
	"missing_reading_default" "missing_reading_default" DEFAULT 'estimate' NOT NULL,
	"extend_default_days" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condo_config_condo_id_unique" UNIQUE("condo_id")
);
--> statement-breakpoint
CREATE TABLE "condos" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"condo_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "group_kind" DEFAULT 'custom' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"condo_id" text NOT NULL,
	"group_id" text,
	"label" text NOT NULL,
	"delta_threshold_pct_override" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_condo_label_key" UNIQUE("condo_id","label")
);
--> statement-breakpoint
CREATE TABLE "linked_meters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"meter_id" text NOT NULL,
	"target_kind" "linked_meter_target_kind" NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linked_meters_meter_target_key" UNIQUE("meter_id","target_kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "meters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"condo_id" text NOT NULL,
	"kind" "meter_kind" NOT NULL,
	"status" "meter_status" DEFAULT 'active' NOT NULL,
	"utility" text DEFAULT 'water' NOT NULL,
	"identifier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_condo_grants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"condo_id" text,
	"role" "condo_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_condo_grants_user_condo_role_key" UNIQUE("user_id","condo_id","role")
);
--> statement-breakpoint
CREATE TABLE "user_unit_grants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_unit_grants_user_unit_key" UNIQUE("user_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"condo_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"state" "period_state" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periods_condo_year_month_key" UNIQUE("condo_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"meter_id" text NOT NULL,
	"period_id" text NOT NULL,
	"operator_id" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"ai_value" numeric(18, 6),
	"ai_confidence" numeric(5, 4),
	"photo_path" text NOT NULL,
	"exif_capture_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gps_lat" numeric(10, 7),
	"gps_lng" numeric(10, 7),
	"device" text,
	"status" "reading_status" DEFAULT 'pending' NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumption" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"meter_id" text NOT NULL,
	"period_id" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"kind" "consumption_kind" DEFAULT 'unit' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumption_meter_period_key" UNIQUE("meter_id","period_id")
);
--> statement-breakpoint
CREATE TABLE "billing_exports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"period_id" text NOT NULL,
	"version" integer NOT NULL,
	"csv_path" text NOT NULL,
	"exported_by" text NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_exports_period_version_key" UNIQUE("period_id","version")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condo_config" ADD CONSTRAINT "condo_config_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_meters" ADD CONSTRAINT "linked_meters_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_condo_grants" ADD CONSTRAINT "user_condo_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_condo_grants" ADD CONSTRAINT "user_condo_grants_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unit_grants" ADD CONSTRAINT "user_unit_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unit_grants" ADD CONSTRAINT "user_unit_grants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_condo_id_condos_id_fk" FOREIGN KEY ("condo_id") REFERENCES "public"."condos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption" ADD CONSTRAINT "consumption_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption" ADD CONSTRAINT "consumption_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_exports" ADD CONSTRAINT "billing_exports_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_exports" ADD CONSTRAINT "billing_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "readings_meter_period_when_not_rejected" ON "readings" USING btree ("meter_id","period_id") WHERE "readings"."status" <> 'rejected';