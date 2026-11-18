import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { applications, companies } from '../schema';

// The ownership rules, written once. Only companies have a user_id; everything else belongs to a user
// through a company (applications -> company, contacts -> company, interview stages -> application -> company).
// Repositories reuse these instead of re-spelling the joins, so the rule can't drift between routes.

// The ids of the companies this user owns, as a subquery: `inArray(contacts.company_id, ownedCompanyIds(userId))`.
export const ownedCompanyIds = (userId: string) =>
  db.select({ id: companies.id }).from(companies).where(eq(companies.user_id, userId));

// The ids of the applications this user owns (those at a company they own).
export const ownedApplicationIds = (userId: string) =>
  db.select({ id: applications.id }).from(applications).where(inArray(applications.company_id, ownedCompanyIds(userId)));

// Used before moving or creating something under a parent: the NEW parent must belong to the user too.
export async function ownsCompany(userId: string, companyId: number) {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.user_id, userId)));
  return Boolean(row);
}

export async function ownsApplication(userId: string, applicationId: number) {
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, applicationId), inArray(applications.company_id, ownedCompanyIds(userId))));
  return Boolean(row);
}
