import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { asA, asB } from '../testing/helpers';

let companyA: { id: number };
let companyB: { id: number };

beforeEach(async () => {
  companyA = (await asA(request(app).post('/companies')).send({ name: 'Acme' }).expect(200)).body;
  companyB = (await asB(request(app).post('/companies')).send({ name: 'Beta' }).expect(200)).body;
});

const createContact = (name: string, companyId = companyA.id, as = asA) =>
  as(request(app).post('/contacts')).send({ company_id: companyId, name, role: 'Recruiter', email: 'a@b.test', linkedin_url: null, notes: null });

describe('contacts', () => {
  it("creates contacts and lists only the caller's, newest first", async () => {
    await createContact('First').expect(200);
    await createContact('Second').expect(200);
    await createContact('Theirs', companyB.id, asB).expect(200);
    const list = (await asA(request(app).get('/contacts')).expect(200)).body;
    expect(list.map((c: { name: string }) => c.name)).toEqual(['Second', 'First']);
  });

  it("cannot create a contact under another user's company", async () => {
    await createContact('Sneaky', companyB.id).expect(404);
  });

  it("hides, refuses to edit and refuses to delete another user's contact", async () => {
    const { id } = (await createContact('Mine').expect(200)).body;
    await asB(request(app).get(`/contacts/${id}`)).expect(404);
    await asB(request(app).put(`/contacts/${id}`)).send({ company_id: companyB.id, name: 'Hacked' }).expect(404);
    await asB(request(app).delete(`/contacts/${id}`)).expect(404);
    expect((await asA(request(app).get(`/contacts/${id}`)).expect(200)).body.name).toBe('Mine');
  });

  it("cannot move own contact to another user's company", async () => {
    const { id } = (await createContact('Mine').expect(200)).body;
    await asA(request(app).put(`/contacts/${id}`)).send({ company_id: companyB.id, name: 'Mine' }).expect(404);
    expect((await asA(request(app).get(`/contacts/${id}`)).expect(200)).body.company_id).toBe(companyA.id);
  });

  it('edits and deletes own contact', async () => {
    const { id } = (await createContact('Old').expect(200)).body;
    const edited = await asA(request(app).put(`/contacts/${id}`)).send({ company_id: companyA.id, name: 'New', role: null, email: null, linkedin_url: null, notes: 'x' }).expect(200);
    expect(edited.body).toMatchObject({ name: 'New', role: null, notes: 'x' });
    await asA(request(app).delete(`/contacts/${id}`)).expect(200);
    await asA(request(app).get(`/contacts/${id}`)).expect(404);
  });

  it('answers 404 (not a server error) for an id that is not a number', async () => {
    await asA(request(app).get('/contacts/abc')).expect(404);
    await asA(request(app).put('/contacts/abc')).send({ company_id: companyA.id, name: 'x' }).expect(404);
    await asA(request(app).delete('/contacts/abc')).expect(404);
  });
});
