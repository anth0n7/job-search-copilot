import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { interviewStages } from '../schema';
import { ownedApplicationIds, ownsApplication } from './owned';

// Interview stages belong to a user through their application, which belongs to a company (see owned.ts).
// Every query here is limited to stages of applications the user owns, including update and delete.

export type InterviewStageInput = {
  application_id: number;
  stage_name: string;
  scheduled_date: Date | null;
  completed: boolean;
  notes: string | null;
};

const ofOwnedApplication = (userId: string) => inArray(interviewStages.application_id, ownedApplicationIds(userId));

export function listInterviewStages(userId: string) {
  return db.select().from(interviewStages).where(ofOwnedApplication(userId)).orderBy(desc(interviewStages.id));
}

export function listInterviewStagesByApplication(userId: string, applicationId: number) {
  return db
    .select()
    .from(interviewStages)
    .where(and(eq(interviewStages.application_id, applicationId), ofOwnedApplication(userId)))
    .orderBy(desc(interviewStages.id));
}

export async function getInterviewStage(userId: string, id: number) {
  const [stage] = await db.select().from(interviewStages).where(and(eq(interviewStages.id, id), ofOwnedApplication(userId)));
  return stage ?? null;
}

// null = the application isn't yours (or doesn't exist)
export async function createInterviewStage(userId: string, input: InterviewStageInput) {
  if (!(await ownsApplication(userId, input.application_id))) return null;
  const [stage] = await db.insert(interviewStages).values(input).returning();
  return stage!;
}

// null = the stage isn't yours, or the application you're moving it to isn't yours
export async function updateInterviewStage(userId: string, id: number, input: InterviewStageInput) {
  if (!(await ownsApplication(userId, input.application_id))) return null;
  const [stage] = await db
    .update(interviewStages)
    .set(input)
    .where(and(eq(interviewStages.id, id), ofOwnedApplication(userId)))
    .returning();
  return stage ?? null;
}

export async function deleteInterviewStage(userId: string, id: number) {
  const [stage] = await db.delete(interviewStages).where(and(eq(interviewStages.id, id), ofOwnedApplication(userId))).returning();
  return stage ?? null;
}
