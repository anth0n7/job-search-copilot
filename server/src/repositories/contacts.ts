import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { contacts } from '../schema';
import { ownedCompanyIds, ownsCompany } from './owned';

// Contacts have no user column: they belong to a user through their company (see owned.ts).
// Every query here is limited to contacts at companies the user owns, including update and delete.

export type ContactInput = {
  company_id: number;
  name: string;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

const atOwnedCompany = (userId: string) => inArray(contacts.company_id, ownedCompanyIds(userId));

export function listContacts(userId: string) {
  return db.select().from(contacts).where(atOwnedCompany(userId)).orderBy(desc(contacts.id));
}

export function listContactsByCompany(userId: string, companyId: number) {
  return db.select().from(contacts).where(and(eq(contacts.company_id, companyId), atOwnedCompany(userId))).orderBy(desc(contacts.id));
}

export async function getContact(userId: string, id: number) {
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), atOwnedCompany(userId)));
  return contact ?? null;
}

// null = the company isn't yours (or doesn't exist)
export async function createContact(userId: string, input: ContactInput) {
  if (!(await ownsCompany(userId, input.company_id))) return null;
  const [contact] = await db.insert(contacts).values(input).returning();
  return contact!;
}

// null = the contact isn't yours, or the company you're moving it to isn't yours
export async function updateContact(userId: string, id: number, input: ContactInput) {
  if (!(await ownsCompany(userId, input.company_id))) return null;
  const [contact] = await db.update(contacts).set(input).where(and(eq(contacts.id, id), atOwnedCompany(userId))).returning();
  return contact ?? null;
}

export async function deleteContact(userId: string, id: number) {
  const [contact] = await db.delete(contacts).where(and(eq(contacts.id, id), atOwnedCompany(userId))).returning();
  return contact ?? null;
}
