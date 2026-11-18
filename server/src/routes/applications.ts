import { Router } from 'express'
import { requireAuth, currentUserId } from '../middleware'
import { sendServerError, isBlank, errorCode } from '../errors'
import { parseId, isId } from '../parseId'
import { createApplication, deleteApplication, getApplication, listApplications, updateApplication } from '../repositories/applications'
import type { ApplicationInput } from '../repositories/applications'
import { listInterviewStagesByApplication } from '../repositories/interviewStages'

const router = Router();

// A calendar date must be a real 'YYYY-MM-DD' (so '2026-13-45' is refused here, not by a database error)
function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // JavaScript rolls over some impossible dates (Feb 30 becomes Mar 2) and throws on others (month 13),
  // so check the date is valid and reads back as the same text
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Reads and checks the request body. Returns the input, or the message to send back with a 400.
function readApplicationInput(body: Record<string, unknown>): ApplicationInput | string {
  const { company_id, role_title, job_posting_url, status, application_date } = body;
  if (isBlank(role_title)) return 'Role title is required';
  if (!isId(company_id)) return 'company_id must be a positive whole number';
  if (application_date !== null && application_date !== undefined && (typeof application_date !== 'string' || !isCalendarDate(application_date))) {
    return 'application_date must be a real date like 2026-11-09';
  }
  if (status !== undefined && typeof status !== 'string') return 'status must be text';
  return {
    company_id,
    role_title: role_title as string,
    job_posting_url: (job_posting_url as string | null | undefined) ?? null,
    status: status as string | undefined,
    application_date: (application_date as string | null | undefined) ?? null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    res.json(await listApplications(userId));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const input = readApplicationInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const application = await createApplication(userId, input);
    if (!application) {
      return res.status(403).json({ error: 'User not allowed access to company' });
    }
    res.json(application);
  } catch (err) {
    if (errorCode(err) === '23503') {
      return res.status(400).json({ error: 'That company does not exist' });
    }
    sendServerError(res, err);
  }
});

//404 is good here because it doesn't reveal "exists but not yours"
router.get('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const application = id === null ? null : await getApplication(userId, id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const input = readApplicationInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const id = parseId(req.params.id);
    const application = id === null ? null : await updateApplication(userId, id, input);
    if (!application) {
      return res.status(404).json({ error: 'Application or company not found' });
    }
    res.json(application);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const application = id === null ? null : await deleteApplication(userId, id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/interview_stages', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    res.json(id === null ? [] : await listInterviewStagesByApplication(userId, id));
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
