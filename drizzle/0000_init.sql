CREATE TYPE "public"."email_status" AS ENUM('verified', 'unverified', 'invalid', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."list_item_status" AS ENUM('new', 'reviewing', 'approved', 'sent', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('linkedin', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'approved', 'edited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'va', 'advisor');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_assignments" (
	"user_id" text NOT NULL,
	"advisor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisor_assignments_user_id_advisor_id_pk" PRIMARY KEY("user_id","advisor_id")
);
--> statement-breakpoint
CREATE TABLE "advisor_signal_weights" (
	"advisor_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"weight" real NOT NULL,
	CONSTRAINT "advisor_signal_weights_advisor_id_signal_type_pk" PRIMARY KEY("advisor_id","signal_type"),
	CONSTRAINT "advisor_signal_weights_range" CHECK ("advisor_signal_weights"."weight" >= 0 and "advisor_signal_weights"."weight" <= 1)
);
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"firm" text,
	"niche" text,
	"target_titles" text[] DEFAULT '{}'::text[] NOT NULL,
	"seniority" text[] DEFAULT '{}'::text[] NOT NULL,
	"industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"geography" text[] DEFAULT '{}'::text[] NOT NULL,
	"aum_minimum" bigint,
	"compliance_notes" text,
	"daily_quota" integer DEFAULT 25 NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cadence_steps" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"offset_hours" integer NOT NULL,
	"window_start" time NOT NULL,
	"window_end" time NOT NULL,
	CONSTRAINT "cadence_steps_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"cik" text,
	"industry" text,
	"headcount" integer,
	"funding_stage" text,
	"last_round_amount" bigint,
	"last_round_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_domain_unique" UNIQUE("domain"),
	CONSTRAINT "companies_cik_unique" UNIQUE("cik")
);
--> statement-breakpoint
CREATE TABLE "daily_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" uuid NOT NULL,
	"list_date" date NOT NULL,
	"prospect_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"status" "list_item_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"channel" "message_channel" NOT NULL,
	"original_body" text NOT NULL,
	"body" text NOT NULL,
	"subject" text,
	"send_window_start" timestamp with time zone,
	"send_window_end" timestamp with time zone,
	"status" "message_status" DEFAULT 'draft' NOT NULL,
	"editor_notes" text,
	"reject_reason" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"connected_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"positive_reply_at" timestamp with time zone,
	"booked_call_at" timestamp with time zone,
	"client_won_at" timestamp with time zone,
	"logged_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"title" text,
	"seniority" text,
	"company_id" uuid,
	"linkedin_url" text,
	"email" text,
	"email_status" "email_status" DEFAULT 'unknown' NOT NULL,
	"location" text,
	"timezone" text,
	"country" text DEFAULT 'US' NOT NULL,
	"source" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"run_date" date NOT NULL,
	"rule_score" real NOT NULL,
	"predicted_score" real,
	"final_score" real NOT NULL,
	"reason_text" text,
	"model_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signal_types" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"default_weight" real NOT NULL,
	"is_gate" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"company_id" uuid,
	"type" text NOT NULL,
	"occurred_on" date NOT NULL,
	"headline" text NOT NULL,
	"source_url" text,
	"raw" jsonb,
	"strength" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_target" CHECK ("signals"."prospect_id" is not null or "signals"."company_id" is not null),
	CONSTRAINT "signals_strength_range" CHECK ("signals"."strength" >= 0 and "signals"."strength" <= 1)
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"linkedin_url" text,
	"reason" text NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_target" CHECK ("suppressions"."email" is not null or "suppressions"."linkedin_url" is not null)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'advisor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_signal_weights" ADD CONSTRAINT "advisor_signal_weights_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_signal_weights" ADD CONSTRAINT "advisor_signal_weights_signal_type_signal_types_key_fk" FOREIGN KEY ("signal_type") REFERENCES "public"."signal_types"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisors" ADD CONSTRAINT "advisors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_lists" ADD CONSTRAINT "daily_lists_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_lists" ADD CONSTRAINT "daily_lists_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_slot_cadence_steps_key_fk" FOREIGN KEY ("slot") REFERENCES "public"."cadence_steps"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_logged_by_user_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_type_signal_types_key_fk" FOREIGN KEY ("type") REFERENCES "public"."signal_types"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_lists_advisor_date_prospect_uq" ON "daily_lists" USING btree ("advisor_id","list_date","prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_lists_advisor_date_rank_uq" ON "daily_lists" USING btree ("advisor_id","list_date","rank");--> statement-breakpoint
CREATE INDEX "daily_lists_advisor_prospect_idx" ON "daily_lists" USING btree ("advisor_id","prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_advisor_prospect_slot_channel_uq" ON "messages" USING btree ("advisor_id","prospect_id","slot","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_advisor_prospect_uq" ON "outcomes" USING btree ("advisor_id","prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_linkedin_url_uq" ON "prospects" USING btree ("linkedin_url");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_email_uq" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "prospects_company_id_idx" ON "prospects" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_advisor_prospect_run_uq" ON "scores" USING btree ("advisor_id","prospect_id","run_date");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "signals_prospect_id_idx" ON "signals" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "signals_company_id_idx" ON "signals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "suppressions_email_idx" ON "suppressions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "suppressions_linkedin_url_idx" ON "suppressions" USING btree ("linkedin_url");