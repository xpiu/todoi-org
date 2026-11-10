CREATE TABLE "capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"tip" text NOT NULL,
	"sr" text NOT NULL,
	"csv" text NOT NULL,
	CONSTRAINT "capabilities_directory_id_key_unique" UNIQUE("directory_id","key"),
	CONSTRAINT "capabilities_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "commercial_details" (
	"record_id" integer PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"year_note" text,
	"price" numeric(8, 2),
	"price_label" text NOT NULL,
	"list_price" numeric(10, 2),
	"list_price_label" text NOT NULL,
	"price_note" text NOT NULL,
	"price_dagger" text,
	"price_published" text,
	"free_plan" boolean NOT NULL,
	"free_plan_note" text NOT NULL,
	"plans" text NOT NULL,
	"hosting" text NOT NULL,
	"security" text NOT NULL,
	"platforms" text NOT NULL,
	"ai" text NOT NULL,
	CONSTRAINT "commercial_details_price" CHECK ("commercial_details"."price" is null or "commercial_details"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"head" text NOT NULL,
	"sr" text NOT NULL,
	"tip" text NOT NULL,
	"text" text NOT NULL,
	"csv" text NOT NULL,
	CONSTRAINT "criteria_directory_id_key_unique" UNIQUE("directory_id","key"),
	CONSTRAINT "criteria_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "directories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"noun_singular" text NOT NULL,
	"noun_plural" text NOT NULL,
	"compiled_on" date NOT NULL,
	"modified_on" date NOT NULL,
	"csv_file" text NOT NULL,
	"toggles" jsonb NOT NULL,
	"copy" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "directories_path_unique" UNIQUE("path"),
	CONSTRAINT "directories_csv_file_unique" UNIQUE("csv_file"),
	CONSTRAINT "directories_kind" CHECK ("directories"."kind" in ('oss', 'commercial'))
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oss_details" (
	"record_id" integer PRIMARY KEY NOT NULL,
	"licence" text NOT NULL,
	"model_note" text NOT NULL,
	"repository" text NOT NULL,
	"repository_url" text NOT NULL,
	"stars" integer NOT NULL,
	"stars_note" text,
	"deployment" text NOT NULL,
	"stack" text NOT NULL,
	"hosted_option" text NOT NULL,
	CONSTRAINT "oss_details_stars" CHECK ("oss_details"."stars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "record_capabilities" (
	"record_id" integer NOT NULL,
	"capability_id" integer NOT NULL,
	"level" smallint NOT NULL,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_capabilities_record_id_capability_id_pk" PRIMARY KEY("record_id","capability_id"),
	CONSTRAINT "record_capabilities_level" CHECK ("record_capabilities"."level" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "record_scores" (
	"record_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"score" numeric(2, 1) NOT NULL,
	"review" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_scores_record_id_criterion_id_pk" PRIMARY KEY("record_id","criterion_id"),
	CONSTRAINT "record_scores_range" CHECK ("record_scores"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "record_sources" (
	"record_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "record_sources_record_id_position_pk" PRIMARY KEY("record_id","position")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"segment_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"icon" text NOT NULL,
	"blurb" text NOT NULL,
	"model_sub" text NOT NULL,
	"summary" text[] NOT NULL,
	"summary_date" date NOT NULL,
	"year" smallint NOT NULL,
	"band" smallint NOT NULL,
	"band_evidence" text NOT NULL,
	"integrations_label" text NOT NULL,
	"integrations" integer NOT NULL,
	"integration_notes" text NOT NULL,
	"calendar_sync" text NOT NULL,
	"data_out" text NOT NULL,
	"caveat" text NOT NULL,
	"confidence" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "records_directory_id_slug_unique" UNIQUE("directory_id","slug"),
	CONSTRAINT "records_band" CHECK ("records"."band" between 1 and 5),
	CONSTRAINT "records_confidence" CHECK ("records"."confidence" in ('High', 'Medium-high', 'Medium')),
	CONSTRAINT "records_slug" CHECK ("records"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revisions_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"case_text" text NOT NULL,
	"pick" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"directory_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"chip" text,
	"chip_aria" text,
	"filter" text NOT NULL,
	"tag_class" text NOT NULL,
	"icon" text NOT NULL,
	"tip" text NOT NULL,
	"definition" text,
	"audience" text,
	"csv_label" text NOT NULL,
	CONSTRAINT "segments_directory_id_key_unique" UNIQUE("directory_id","key"),
	CONSTRAINT "segments_directory_id_position_unique" UNIQUE("directory_id","position")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_details" ADD CONSTRAINT "commercial_details_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oss_details" ADD CONSTRAINT "oss_details_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_capabilities" ADD CONSTRAINT "record_capabilities_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_capabilities" ADD CONSTRAINT "record_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_scores" ADD CONSTRAINT "record_scores_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_scores" ADD CONSTRAINT "record_scores_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_key_at" ON "login_attempts" USING btree ("key","at");--> statement-breakpoint
CREATE INDEX "records_directory" ON "records" USING btree ("directory_id");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry" ON "sessions" USING btree ("expires_at");