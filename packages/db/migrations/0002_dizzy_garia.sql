ALTER TABLE "temp_groups" DROP CONSTRAINT "temp_groups_session_name_key";--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "parent_group_id" text;--> statement-breakpoint
ALTER TABLE "temp_groups" ADD COLUMN "parent_temp_group_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_groups" ADD CONSTRAINT "temp_groups_parent_temp_group_id_temp_groups_id_fk" FOREIGN KEY ("parent_temp_group_id") REFERENCES "public"."temp_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_condo_id_parent_null_name_key" ON "groups" USING btree ("condo_id","name") WHERE "groups"."parent_group_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_condo_id_parent_name_key" ON "groups" USING btree ("condo_id","parent_group_id","name") WHERE "groups"."parent_group_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "temp_groups_session_root_name_key" ON "temp_groups" USING btree ("session_id","name") WHERE "temp_groups"."parent_temp_group_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "temp_groups_session_parent_name_key" ON "temp_groups" USING btree ("session_id","parent_temp_group_id","name") WHERE "temp_groups"."parent_temp_group_id" is not null;