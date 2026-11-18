import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '../db';
import { companies, contacts } from '../schema';

// Contacts have no user column: they belong to a user through their company, so every query joins to it.

export function listContactsByCompany(userId: string, companyId: number) {
  return db
    .select(getTableColumns(contacts))
    .from(contacts)
    .innerJoin(companies, eq(contacts.company_id, companies.id))
    .where(and(eq(companies.id, companyId), eq(companies.user_id, userId)))
    .orderBy(desc(contacts.id));
}
