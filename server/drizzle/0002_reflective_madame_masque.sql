CREATE TABLE "company_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"board_token" text NOT NULL,
	"company_name" text NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_fetch_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_boards_provider_valid" CHECK ("company_boards"."provider" in ('greenhouse', 'lever', 'ashby')),
	CONSTRAINT "company_boards_board_token_valid" CHECK ("company_boards"."board_token" ~ '^[a-z0-9_-]+$'),
	CONSTRAINT "company_boards_company_name_valid" CHECK (length(btrim("company_boards"."company_name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"url" text NOT NULL,
	"description_text" text NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "listings_title_valid" CHECK (length(btrim("listings"."title")) between 1 and 500),
	CONSTRAINT "listings_url_https" CHECK ("listings"."url" like 'https://%')
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_board_id_company_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."company_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_boards_provider_token_unique" ON "company_boards" USING btree ("provider","board_token");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_board_external_unique" ON "listings" USING btree ("board_id","external_id");--> statement-breakpoint
CREATE INDEX "listings_open_newest_idx" ON "listings" USING btree ("closed_at","posted_at");