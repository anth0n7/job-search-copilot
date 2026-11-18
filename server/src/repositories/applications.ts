import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { applications } from '../schema';
import { ownedCompanyIds, ownsCompany } from './owned';

// Applications belong to a user through their company (see owned.ts).
// Every query here is limited to applications at companies the user owns, including update and delete.

export type ApplicationInput = {
  company_id: number;
  role_title: string;
  job_posting_url: string | null;
  // undefined = not sent: a new application gets the database default ('saved'), an edit keeps the current status
  status: string | undefined;
  application_date: string | null;
};

const atOwnedCompany = (userId: string) => inArray(applications.company_id, ownedCompanyIds(userId));

export function listApplications(userId: string) {
  return db.select().from(applications).where(atOwnedCompany(userId)).orderBy(desc(applications.id));
}

export async function getApplication(userId: string, id: number) {
  const [application] = await db.select().from(applications).where(and(eq(applications.id, id), atOwnedCompany(userId)));
  return application ?? null;
}

// null = the company isn't yours (or doesn't exist)
export async function createApplication(userId: string, input: ApplicationInput) {
  if (!(await ownsCompany(userId, input.company_id))) return null;
  const [application] = await db.insert(applications).values(input).returning();
  return application!;
}

// null = the application isn't yours, or the company you're moving it to isn't yours.
// updated_at is refreshed by the database trigger.
export async function updateApplication(userId: string, id: number, input: ApplicationInput) {
  if (!(await ownsCompany(userId, input.company_id))) return null;
  const [application] = await db.update(applications).set(input).where(and(eq(applications.id, id), atOwnedCompany(userId))).returning();
  return application ?? null;
}

export async function deleteApplication(userId: string, id: number) {
  const [application] = await db.delete(applications).where(and(eq(applications.id, id), atOwnedCompany(userId))).returning();
  return application ?? null;
}
