import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import { sendServerError, isBlank, errorCode } from '../errors'
import { parseId, isId } from '../parseId'
import { createContact, deleteContact, getContact, listContacts, updateContact } from '../repositories/contacts'
import type { ContactInput } from '../repositories/contacts'

const router = Router()

// Reads and checks the request body. Returns the input, or the message to send back with a 400.
function readContactInput(body: Record<string, unknown>): ContactInput | string {
  const { company_id, name, role, email, linkedin_url, notes } = body;
  if (isBlank(name)) return 'Name is required';
  if (!isId(company_id)) return 'company_id must be a positive whole number';
  return {
    company_id,
    name: name as string,
    role: (role as string | null | undefined) ?? null,
    email: (email as string | null | undefined) ?? null,
    linkedin_url: (linkedin_url as string | null | undefined) ?? null,
    notes: (notes as string | null | undefined) ?? null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    res.json(await listContacts(userId!));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const id = parseId(req.params.id);
    const contact = id === null ? null : await getContact(userId!, id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const input = readContactInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const contact = await createContact(userId!, input);
    if (!contact) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(contact);
  } catch (err) {
    if (errorCode(err) === '23503') {
      return res.status(400).json({ error: 'That company does not exist' });
    }
    sendServerError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const input = readContactInput(req.body);
    if (typeof input === 'string') {
      return res.status(400).json({ error: input });
    }
    const id = parseId(req.params.id);
    const contact = id === null ? null : await updateContact(userId!, id, input);
    if (!contact) {
      return res.status(404).json({ error: 'Contact or company not found' });
    }
    res.json(contact);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const id = parseId(req.params.id);
    const contact = id === null ? null : await deleteContact(userId!, id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (err) {
    sendServerError(res, err);
  }
});

export default router;
