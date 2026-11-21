CREATE TABLE "listing_embeddings" (
	"listing_id" integer PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_similarities" (
	"resume_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"cosine" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_similarities_resume_id_listing_id_pk" PRIMARY KEY("resume_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "resume_embeddings" (
	"resume_id" integer PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_boards" DROP CONSTRAINT "company_boards_provider_valid";--> statement-breakpoint
ALTER TABLE "company_boards" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "duplicate_of" integer;--> statement-breakpoint
ALTER TABLE "listing_embeddings" ADD CONSTRAINT "listing_embeddings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_similarities" ADD CONSTRAINT "listing_similarities_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_similarities" ADD CONSTRAINT "listing_similarities_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_embeddings" ADD CONSTRAINT "resume_embeddings_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_similarities_listing_id_idx" ON "listing_similarities" USING btree ("listing_id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_duplicate_of_listings_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_duplicate_of_idx" ON "listings" USING btree ("duplicate_of");--> statement-breakpoint
ALTER TABLE "company_boards" ADD CONSTRAINT "company_boards_provider_valid" CHECK ("company_boards"."provider" in ('greenhouse', 'lever', 'ashby', 'remotive'));