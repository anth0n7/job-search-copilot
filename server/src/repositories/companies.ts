import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { companies } from '../schema';

// Every function here takes the signed-in user's id and puts it in the query itself.
// A route can't forget the ownership check, because there is no way to call these without one.
// "Not found" and "not yours" look the same on purpose (null), so a user can't tell which ids exist.

export type CompanyInput = { name: string; website: string | null; notes: string | null };

export function listCompanies(userId: string) {
  return db.select().from(companies).where(eq(companies.user_id, userId)).orderBy(desc(companies.created_at), desc(companies.id));
}

export async function getCompany(userId: string, id: number) {
  const [company] = await db.select().from(companies).where(and(eq(companies.id, id), eq(companies.user_id, userId)));
  return company ?? null;
}

export async function createCompany(userId: string, input: CompanyInput) {
  const [company] = await db.insert(companies).values({ ...input, user_id: userId }).returning();
  return company!;
}

export async function updateCompany(userId: string, id: number, input: CompanyInput) {
  const [company] = await db.update(companies).set(input).where(and(eq(companies.id, id), eq(companies.user_id, userId))).returning();
  return company ?? null;
}

export async function deleteCompany(userId: string, id: number) {
  const [company] = await db.delete(companies).where(and(eq(companies.id, id), eq(companies.user_id, userId))).returning();
  return company ?? null;
}
