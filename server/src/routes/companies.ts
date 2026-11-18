import { Router } from 'express'
import { requireAuth, currentUserId } from '../middleware'
import { sendServerError, isBlank } from '../errors'
import { parseId } from '../parseId'
import { createCompany, deleteCompany, getCompany, listCompanies, updateCompany } from '../repositories/companies'
import { listContactsByCompany } from '../repositories/contacts'

// Routes only deal with HTTP: read the request, check the input, call a repository, send the answer.
// All ownership checks live in the repositories, which require the user id.
const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    res.json(await listCompanies(userId));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const { name, website, notes } = req.body;
    if (isBlank(name)) {
      return res.status(400).json({ error: 'Name is required' });
    }
    res.json(await createCompany(userId, { name, website: website ?? null, notes: notes ?? null }));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const company = id === null ? null : await getCompany(userId, id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const { name, website, notes } = req.body;
    if (isBlank(name)) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const id = parseId(req.params.id);
    const company = id === null ? null : await updateCompany(userId, id, { name, website: website ?? null, notes: notes ?? null });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    const company = id === null ? null : await deleteCompany(userId, id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/contacts', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  try {
    const id = parseId(req.params.id);
    res.json(id === null ? [] : await listContactsByCompany(userId, id));
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
