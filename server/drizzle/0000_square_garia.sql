CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"role_title" text NOT NULL,
	"job_posting_url" text,
	"status" text DEFAULT 'saved' NOT NULL,
	"application_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_role_title_valid" CHECK (length(btrim("applications"."role_title")) between 1 and 200),
	CONSTRAINT "applications_status_valid" CHECK ("applications"."status" in ('saved', 'applied', 'interviewing', 'rejected', 'offer'))
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_name_valid" CHECK (length(btrim("companies"."name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"linkedin_url" text,
	"notes" text,
	CONSTRAINT "contacts_name_valid" CHECK (length(btrim("contacts"."name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "interview_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"stage_name" text NOT NULL,
	"scheduled_date" timestamp with time zone,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "interview_stages_stage_name_valid" CHECK (length(btrim("interview_stages"."stage_name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resume_text" text,
	CONSTRAINT "resumes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_stages" ADD CONSTRAINT "interview_stages_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_company_id_idx" ON "applications" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_user_name_unique" ON "companies" USING btree ("user_id",lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "contacts_company_id_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "interview_stages_application_id_idx" ON "interview_stages" USING btree ("application_id");