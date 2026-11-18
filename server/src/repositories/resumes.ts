import { eq } from 'drizzle-orm';
import { db } from '../db';
import { resumes } from '../schema';

// One resume per user (user_id is unique). Resume text is the most sensitive data in the app.

export async function getResume(userId: string) {
  const [resume] = await db.select().from(resumes).where(eq(resumes.user_id, userId));
  return resume ?? null;
}

// Creates the user's resume or replaces its text. updated_at is refreshed by the database trigger.
export async function saveResume(userId: string, resumeText: string) {
  const [resume] = await db
    .insert(resumes)
    .values({ user_id: userId, resume_text: resumeText })
    .onConflictDoUpdate({ target: resumes.user_id, set: { resume_text: resumeText } })
    .returning();
  return resume!;
}
