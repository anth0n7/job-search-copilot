import { Router } from 'express'
import { requireAuth, currentUserId } from '../middleware'
import { sendServerError, isBlank, errorCode } from '../errors'
import { parseId, isId } from '../parseId'
import {
  createInterviewStage, deleteInterviewStage, getInterviewStage, listInterviewStages, updateInterviewStage,
} from '../repositories/interviewStages'
import type { InterviewStageInput } from '../repositories/interviewStages'

const router = Router()

// Reads and checks the request body. Returns the input, or the message to send back with a 400.
function readStageInput(body: Record<string, unknown>): InterviewStageInput | string {
  const { application_id, stage_name, scheduled_date, completed, notes } = body;
  if (isBlank(stage_name)) return 'Stage name is required';
  if (!isId(application_id)) return 'application_id must be a positive whole number';

  // The browser sends the time as a UTC timestamp string, or null for "not scheduled"
  let scheduled: Date | null = null;
  if (scheduled_date !== null && scheduled_date !== undefined) {
    scheduled = new Date(scheduled_date as string);
    if (typeof scheduled_date !== 'string' || Number.isNaN(scheduled.getTime())) return 'scheduled_date is not a valid date';
  }
  return {
    application_id,
    stage_name: stage_name as string,
    scheduled_date: scheduled,
    completed: Boolean(completed),
    notes: (notes as string | null | undefined) ?? null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    res.json(await listInterviewStages(userId));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const stage = id === null ? null : await getInterviewStage(userId, id);
    if (!stage) {
      return res.status(404).json({ error: 'Interview stage not found' });
    }
    res.json(stage);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const input = readStageInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const stage = await createInterviewStage(userId, input);
    if (!stage) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(stage);
  } catch (err) {
    if (errorCode(err) === '23503') {
      return res.status(400).json({ error: 'That application does not exist' });
    }
    sendServerError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const input = readStageInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const id = parseId(req.params.id);
    const stage = id === null ? null : await updateInterviewStage(userId, id, input);
    if (!stage) {
      return res.status(404).json({ error: 'Interview stage or application not found' });
    }
    res.json(stage);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const stage = id === null ? null : await deleteInterviewStage(userId, id);
    if (!stage) {
      return res.status(404).json({ error: 'Interview stage not found' });
    }
    res.json(stage);
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
