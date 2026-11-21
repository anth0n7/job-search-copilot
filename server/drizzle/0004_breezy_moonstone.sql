ALTER TABLE "company_boards" ADD COLUMN "suspicious_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_embeddings" ADD COLUMN "text_hash" text;