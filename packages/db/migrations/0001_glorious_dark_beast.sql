CREATE TYPE "public"."onboarding_session_status" AS ENUM('draft', 'committed');--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_id" text NOT NULL,
	"condo_name" text NOT NULL,
	"condo_slug" text NOT NULL,
	"logo_image" text,
	"prompt" text NOT NULL,
	"status" "onboarding_session_status" DEFAULT 'draft' NOT NULL,
	"committed_condo_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temp_groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"session_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "group_kind" DEFAULT 'custom' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temp_groups_session_name_key" UNIQUE("session_id","name")
);
--> statement-breakpoint
CREATE TABLE "temp_meters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"session_id" text NOT NULL,
	"kind" "meter_kind" NOT NULL,
	"identifier" text,
	"target_kind" "linked_meter_target_kind" NOT NULL,
	"target_temp_unit_id" text,
	"target_temp_group_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temp_units" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"session_id" text NOT NULL,
	"temp_group_id" text,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temp_units_session_label_key" UNIQUE("session_id","label")
);
--> statement-breakpoint
DROP INDEX "readings_meter_period_when_not_rejected";--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_committed_condo_id_condos_id_fk" FOREIGN KEY ("committed_condo_id") REFERENCES "public"."condos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_groups" ADD CONSTRAINT "temp_groups_session_id_onboarding_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_meters" ADD CONSTRAINT "temp_meters_session_id_onboarding_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_meters" ADD CONSTRAINT "temp_meters_target_temp_unit_id_temp_units_id_fk" FOREIGN KEY ("target_temp_unit_id") REFERENCES "public"."temp_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_meters" ADD CONSTRAINT "temp_meters_target_temp_group_id_temp_groups_id_fk" FOREIGN KEY ("target_temp_group_id") REFERENCES "public"."temp_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_units" ADD CONSTRAINT "temp_units_session_id_onboarding_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_units" ADD CONSTRAINT "temp_units_temp_group_id_temp_groups_id_fk" FOREIGN KEY ("temp_group_id") REFERENCES "public"."temp_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "readings_meter_period_when_not_rejected" ON "readings" USING btree ("meter_id","period_id") WHERE "readings"."status" <> 'rejected';