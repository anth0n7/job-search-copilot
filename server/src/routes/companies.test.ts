import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { asA, asB } from '../testing/helpers';

const createCompany = (name: string, as = asA) => as(request(app).post('/companies')).send({ name, website: 'https://x.test', notes: 'n' });

describe('companies', () => {
  it('creates a company and lists only the caller\'s, newest first', async () => {
    const first = (await createCompany('First').expect(200)).body;
    const second = (await createCompany('Second').expect(200)).body;
    await createCompany('Other user\'s', asB).expect(200);

    expect(first).toMatchObject({ name: 'First', website: 'https://x.test', notes: 'n', user_id: 'user_A' });
    const list = (await asA(request(app).get('/companies')).expect(200)).body;
    expect(list.map((c: { name: string }) => c.name)).toEqual(['Second', 'First']);
    expect(list[0].id).toBe(second.id);
  });

  it('hides, refuses to edit and refuses to delete another user\'s company', async () => {
    const { id } = (await createCompany('Mine').expect(200)).body;
    await asB(request(app).get(`/companies/${id}`)).expect(404);
    await asB(request(app).put(`/companies/${id}`)).send({ name: 'Hacked' }).expect(404);
    await asB(request(app).delete(`/companies/${id}`)).expect(404);
    expect((await asA(request(app).get(`/companies/${id}`)).expect(200)).body.name).toBe('Mine');
  });

  it('edits a company', async () => {
    const { id } = (await createCompany('Old').expect(200)).body;
    const res = await asA(request(app).put(`/companies/${id}`)).send({ name: 'New', website: null, notes: 'changed' }).expect(200);
    expect(res.body).toMatchObject({ name: 'New', website: null, notes: 'changed' });
  });

  it('rejects an edit that renames a company to one the user already has', async () => {
    await createCompany('Acme').expect(200);
    const { id } = (await createCompany('Other').expect(200)).body;
    await asA(request(app).put(`/companies/${id}`)).send({ name: 'ACME' }).expect(409);
  });

  it('deletes a company together with its applications and contacts', async () => {
    const { id } = (await createCompany('Doomed').expect(200)).body;
    const application = (await asA(request(app).post('/applications')).send({ company_id: id, role_title: 'Eng', status: 'saved' }).expect(200)).body;
    await asA(request(app).post('/contacts')).send({ company_id: id, name: 'Pat' }).expect(200);

    await asA(request(app).delete(`/companies/${id}`)).expect(200);
    await asA(request(app).get(`/applications/${application.id}`)).expect(404);
    expect((await asA(request(app).get(`/companies/${id}/contacts`)).expect(200)).body).toEqual([]);
  });

  it('lists a company\'s contacts only for its owner', async () => {
    const { id } = (await createCompany('Mine').expect(200)).body;
    await asA(request(app).post('/contacts')).send({ company_id: id, name: 'Pat' }).expect(200);
    expect((await asA(request(app).get(`/companies/${id}/contacts`)).expect(200)).body).toHaveLength(1);
    expect((await asB(request(app).get(`/companies/${id}/contacts`)).expect(200)).body).toEqual([]);
  });

  it('answers 404 (not a server error) for an id that is not a number', async () => {
    await asA(request(app).get('/companies/abc')).expect(404);
    await asA(request(app).delete('/companies/99999999999999')).expect(404);
  });
});
