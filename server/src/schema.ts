import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
