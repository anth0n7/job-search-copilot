import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, date, index, integer, pgTable, primaryKey, real, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// The single source of truth for the database.
// Property names are snake_case on purpose: they match the column names and the JSON the API sends
// (the client's types mirror them), so a row from a query can be returned as is, with no mapping layer. Queries get their types from these tables, and
// `npm run db:generate` turns changes here into numbered SQL files in server/drizzle/.
// Rules are enforced here (in the database) as well as in the routes, so a bug in one layer
// can't store bad data.

// A name must have text in it (not just spaces) and stay a sane length.
const nameIsValid = (column: unknown) => sql`length(btrim(${column})) between 1 and 200`;

// timestamptz stores the exact moment; plain `timestamp` silently drops the time zone.
const createdAtColumn = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    // Clerk's user id. Companies are the root of ownership: everything else belongs to a user through a company.
    user_id: text('user_id').notNull(),
    name: text('name').notNull(),
    website: text('website'),
    notes: text('notes'),
    created_at: createdAtColumn(),
  },
  (t) => [
    check('companies_name_valid', nameIsValid(t.name)),
    // One company per name per user, ignoring capitals and extra spaces ("Acme" and "acme " are the same company).
    // Its first column is user_id, so it also serves every "this user's companies" lookup.
    uniqueIndex('companies_user_name_unique').on(t.user_id, sql`lower(btrim(${t.name}))`),
  ],
);

export const APPLICATION_STATUSES = ['saved', 'applied', 'interviewing', 'rejected', 'offer'] as const;
// A CHECK is part of the table definition, so the values are written into the SQL text (they are our own constants, never user input).
const statusList = sql.raw(APPLICATION_STATUSES.map((s) => `'${s}'`).join(', '));

export const applications = pgTable(
  'applications',
  {
    id: serial('id').primaryKey(),
    company_id: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    role_title: text('role_title').notNull(),
    job_posting_url: text('job_posting_url'),
    status: text('status').notNull().default('saved'),
    // A calendar date with no time or time zone, kept as a plain 'YYYY-MM-DD' string.
    application_date: date('application_date', { mode: 'string' }),
    created_at: createdAtColumn(),
    // Kept current by a database trigger (see the second migration), so no query can forget to set it.
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('applications_role_title_valid', nameIsValid(t.role_title)),
    check('applications_status_valid', sql`${t.status} in (${statusList})`),
    // Postgres does not index foreign keys automatically; the ownership joins use this.
    index('applications_company_id_idx').on(t.company_id),
  ],
);

export const contacts = pgTable(
  'contacts',
  {
    id: serial('id').primaryKey(),
    company_id: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    email: text('email'),
    linkedin_url: text('linkedin_url'),
    notes: text('notes'),
  },
  (t) => [check('contacts_name_valid', nameIsValid(t.name)), index('contacts_company_id_idx').on(t.company_id)],
);

export const interviewStages = pgTable(
  'interview_stages',
  {
    id: serial('id').primaryKey(),
    application_id: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    stage_name: text('stage_name').notNull(),
    // The exact moment (UTC); the browser converts to and from local time.
    scheduled_date: timestamp('scheduled_date', { withTimezone: true }),
    completed: boolean('completed').notNull().default(false),
    notes: text('notes'),
  },
  (t) => [
    check('interview_stages_stage_name_valid', nameIsValid(t.stage_name)),
    index('interview_stages_application_id_idx').on(t.application_id),
  ],
);

export const resumes = pgTable('resumes', {
  id: serial('id').primaryKey(),
  // One resume per user.
  user_id: text('user_id').notNull().unique(),
  // Kept current by the same trigger as applications.updated_at.
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  resume_text: text('resume_text'),
});

export const BOARD_PROVIDERS = ['greenhouse', 'lever', 'ashby'] as const;
// Remotive is not a company board: one feed holds many companies. It is stored as a board row anyway so it shares
// the fetch status, the unique key and the closing logic, and each of its listings carries its own company_name.
export const SOURCES = [...BOARD_PROVIDERS, 'remotive'] as const;
const providerList = sql.raw(SOURCES.map((p) => `'${p}'`).join(', '));

// Shared data: boards have no user_id because every user sees the same job listings (spec 3.8).
// Only the fetcher touches these tables, never a user-facing route, so the ownership rule in owned.ts does not apply.
export const companyBoards = pgTable(
  'company_boards',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull(),
    // Goes inside a request URL, so the database refuses anything but the safe characters too.
    board_token: text('board_token').notNull(),
    company_name: text('company_name').notNull(),
    last_fetched_at: timestamp('last_fetched_at', { withTimezone: true }),
    // When a fetch was last started, successful or not. Remotive allows 4 requests a day, so the job checks this first.
    last_attempt_at: timestamp('last_attempt_at', { withTimezone: true }),
    // A short fixed message, never raw error text or a reply body.
    last_fetch_error: text('last_fetch_error'),
    // Consecutive fetches whose reply looked too small to trust; after 3 the daily job closes the missing listings anyway.
    suspicious_streak: integer('suspicious_streak').notNull().default(0),
    created_at: createdAtColumn(),
  },
  (t) => [
    check('company_boards_provider_valid', sql`${t.provider} in (${providerList})`),
    check('company_boards_board_token_valid', sql`${t.board_token} ~ '^[a-z0-9_-]+$'`),
    check('company_boards_company_name_valid', nameIsValid(t.company_name)),
    uniqueIndex('company_boards_provider_token_unique').on(t.provider, t.board_token),
  ],
);

export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    board_id: integer('board_id')
      .notNull()
      .references(() => companyBoards.id, { onDelete: 'cascade' }),
    // The provider's own job id; with board_id it identifies a posting so a re-fetch updates it instead of duplicating it.
    external_id: text('external_id').notNull(),
    // Only set for sources whose board holds many companies (Remotive); otherwise the board's company_name applies.
    company_name: text('company_name'),
    title: text('title').notNull(),
    location: text('location'),
    url: text('url').notNull(),
    // Plain text: the fetcher strips the provider's HTML, so nothing downstream handles untrusted markup.
    description_text: text('description_text').notNull(),
    // Not every provider reports it.
    posted_at: timestamp('posted_at', { withTimezone: true }),
    first_seen_at: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    // Set by the daily job when a posting disappears from its board; cleared again if it reappears.
    closed_at: timestamp('closed_at', { withTimezone: true }),
    // Set on a Remotive listing when a company board lists the same job (spec 3.4: the board's version wins).
    // Discover hides listings where this is set. Recomputed by the daily job, so it never goes stale.
    duplicate_of: integer('duplicate_of').references((): AnyPgColumn => listings.id, { onDelete: 'set null' }),
  },
  (t) => [
    // Longer than the 200 allowed for names: real job titles can be long, and one oversized title must not make a whole board's fetch fail.
    check('listings_title_valid', sql`length(btrim(${t.title})) between 1 and 500`),
    // The link is shown to users and opened in a new tab, so only https is allowed (no javascript: links).
    check('listings_url_https', sql`${t.url} like 'https://%'`),
    uniqueIndex('listings_board_external_unique').on(t.board_id, t.external_id),
    // Discover lists open listings newest first.
    index('listings_open_newest_idx').on(t.closed_at, t.posted_at),
    index('listings_duplicate_of_idx').on(t.duplicate_of),
  ],
);

// Shared, like listings: one embedding per listing, computed once by the daily job. Stored as a float array
// (no pgvector): similarity is computed in code, so the database never has to search by vector.
export const listingEmbeddings = pgTable('listing_embeddings', {
  listing_id: integer('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  // Numbers from different models cannot be compared, so the model is kept and a change triggers a re-embed.
  model: text('model').notNull(),
  // md5 of the text that was embedded (title + description), so an edited posting is re-embedded. Null = unknown, treated as stale.
  text_hash: text('text_hash'),
  embedding: real('embedding').array().notNull(),
  created_at: createdAtColumn(),
});

// One embedding per resume. text_hash says which resume text it was made from, so an edited resume is re-embedded.
export const resumeEmbeddings = pgTable('resume_embeddings', {
  resume_id: integer('resume_id')
    .primaryKey()
    .references(() => resumes.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  text_hash: text('text_hash').notNull(),
  embedding: real('embedding').array().notNull(),
  created_at: createdAtColumn(),
});

// Raw cosine similarity (about -1..1) between a resume and a listing; the 0-100 rescaling belongs to scoring (spec 4.1).
// Tied to resumes, so it is removed with the resume (delete-my-data) and when the resume changes.
export const listingSimilarities = pgTable(
  'listing_similarities',
  {
    resume_id: integer('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    listing_id: integer('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    cosine: real('cosine').notNull(),
    created_at: createdAtColumn(),
  },
  (t) => [primaryKey({ columns: [t.resume_id, t.listing_id] }), index('listing_similarities_listing_id_idx').on(t.listing_id)],
);
