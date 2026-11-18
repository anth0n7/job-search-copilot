import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import { sendServerError } from '../errors'
import { getResume, saveResume } from '../repositories/resumes'

const router = Router();

router.put('/', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const { resume_text } = req.body;
    // An empty string is allowed (clearing the resume); a missing or non-text value is not
    if (typeof resume_text !== 'string') {
      return res.status(400).json({ error: 'Resume text is required' });
    }
    res.json(await saveResume(userId!, resume_text));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    res.json(await getResume(userId!));
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
