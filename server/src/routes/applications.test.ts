import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

// Fake Clerk: the x-test-user header decides who is "logged in", so no real sign-in is needed
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => {
    const userId = req.headers['x-test-user'];
    return { userId, isAuthenticated: Boolean(userId) };
  },
}));

import app from '../app';
import { pool } from '../db';

//add a header to a request "send this request with the label of user_a/b attached"
const asA = (r: request.Test) => r.set('x-test-user', 'user_A');
const asB = (r: request.Test) => r.set('x-test-user', 'user_B');

let companyA: { id: number };
let appA: { id: number };

//This creates one company and one application for a given user. 
async function createCompanyAndApp(as: typeof asA, name: string) {
  const company = (await as(request(app).post('/companies')).send({ name })).body;
  const application = (await as(request(app).post('/applications'))
    .send({ company_id: company.id, role_title: 'Engineer', status: 'saved' })).body;
  return { company, application };
}

//the "reset" before and after the tests.
//Before every test it resets the test database to a clean, known state
//before each: run this code before every single it(..) in this file
beforeEach(async () => {
  // Safety net: these tests wipe every table, so refuse to run against anything but the test DB
  const { rows } = await pool.query('SELECT current_database() AS db');
  if (!rows[0].db.endsWith('_test')) throw new Error(`Refusing to wipe database "${rows[0].db}"`);

  await pool.query('TRUNCATE companies, applications, contacts, interview_stages, resumes RESTART IDENTITY CASCADE');
  //resets spies
  vi.clearAllMocks();
  ({ company: companyA, application: appA } = await createCompanyAndApp(asA, 'Acme'));
});

//After all tests are finished close the database connection. 
afterAll(async () => {
  await pool.end();
});

//Test 1: no user at all
describe('authentication', () => {
  it('rejects requests with no user', async () => {
    await request(app).get('/applications').expect(401);
    await request(app).get(`/applications/${appA.id}/interview_stages`).expect(401);
  });
});

describe('error responses', () => {
  it('hides database error details on a 500', async () => {
    // "abc" is not a valid integer id, so Postgres throws
    const res = await asA(request(app).get('/applications/abc')).expect(500);
    expect(res.body.error).toBe('Something went wrong on the server.');
  });

  it('returns JSON (not HTML) when the request body is too large', async () => {
    const res = await asA(request(app).put('/resumes')).send({ resume_text: 'x'.repeat(200_000) }).expect(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('returns JSON (not HTML) when the request body is malformed JSON', async () => {
    const res = await asA(request(app).put('/resumes'))
      .set('Content-Type', 'application/json').send('{ not json').expect(400);
    expect(res.body.error).toMatch(/invalid json/i);
  });
});

describe('dates and times', () => {
  it('returns an application date as a plain YYYY-MM-DD string', async () => {
    const res = await asA(request(app).post('/applications'))
      .send({ company_id: companyA.id, role_title: 'Dated', status: 'saved', application_date: '2026-11-09' }).expect(200);
    expect(res.body.application_date).toBe('2026-11-09');
    const again = await asA(request(app).get(`/applications/${res.body.id}`)).expect(200);
    expect(again.body.application_date).toBe('2026-11-09');
  });

  it('stores an interview time as the same moment it was sent', async () => {
    const sent = '2026-11-09T15:00:00.000Z';
    const created = await asA(request(app).post('/interview_stages'))
      .send({ application_id: appA.id, stage_name: 'Phone', scheduled_date: sent }).expect(200);
    expect(new Date(created.body.scheduled_date).toISOString()).toBe(sent);

    // saving again with the value we got back must not move the time
    const edited = await asA(request(app).put(`/interview_stages/${created.body.id}`))
      .send({ application_id: appA.id, stage_name: 'Phone', scheduled_date: created.body.scheduled_date, completed: false, notes: 'x' }).expect(200);
    expect(new Date(edited.body.scheduled_date).toISOString()).toBe(sent);
  });
});

describe('database rules', () => {
  it('updates updated_at when an application is edited', async () => {
    const before = (await asA(request(app).get(`/applications/${appA.id}`)).expect(200)).body;
    await new Promise((r) => setTimeout(r, 20));
    const after = (await asA(request(app).put(`/applications/${appA.id}`))
      .send({ company_id: companyA.id, role_title: 'Renamed', status: 'applied' }).expect(200)).body;
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });

  it('rejects a status that is not one of the five allowed values', async () => {
    await asA(request(app).put(`/applications/${appA.id}`))
      .send({ company_id: companyA.id, role_title: 'Engineer', status: 'banana' }).expect(400);
  });

  it('has indexes on the foreign-key columns', async () => {
    const { rows } = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'");
    const names = rows.map((r: { indexname: string }) => r.indexname);
    for (const wanted of ['companies_user_id_idx', 'applications_company_id_idx', 'contacts_company_id_idx', 'interview_stages_application_id_idx']) {
      expect(names).toContain(wanted);
    }
  });
});

describe('required fields', () => {
  it('rejects a blank company name on create and edit', async () => {
    await asA(request(app).post('/companies')).send({ name: '   ' }).expect(400);
    await asA(request(app).put(`/companies/${companyA.id}`)).send({ name: '' }).expect(400);
  });

  it('rejects a blank contact name', async () => {
    await asA(request(app).post('/contacts')).send({ company_id: companyA.id, name: ' ' }).expect(400);
  });

  it('rejects a blank interview stage name', async () => {
    await asA(request(app).post('/interview_stages')).send({ application_id: appA.id, stage_name: '' }).expect(400);
  });

  it('rejects a blank application role title', async () => {
    await asA(request(app).post('/applications'))
      .send({ company_id: companyA.id, role_title: '', status: 'saved' }).expect(400);
  });
});

describe('list order', () => {
  it('returns interview stages newest first', async () => {
    const make = (name: string) => asA(request(app).post('/interview_stages')).send({ application_id: appA.id, stage_name: name }).expect(200);
    await make('first'); await make('second'); await make('third');
    const res = await asA(request(app).get(`/applications/${appA.id}/interview_stages`)).expect(200);
    expect(res.body.map((s: { stage_name: string }) => s.stage_name)).toEqual(['third', 'second', 'first']);
  });
});

describe('cors and the database pool', () => {
  it('only allows the frontend origin', async () => {
    const ok = await request(app).get('/applications').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(app).get('/applications').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not crash when an idle database connection errors', () => {
    expect(() => pool.emit('error', new Error('connection lost'))).not.toThrow();
  });
});

describe('application ownership', () => {
  //Test 2: list only your own data
  it("lists only the caller's applications", async () => {
    expect((await asA(request(app).get('/applications')).expect(200)).body).toHaveLength(1);
    //B owns nothing, so the list must be empty
    expect((await asB(request(app).get('/applications')).expect(200)).body).toEqual([]);
  });

  //Test 3: can't read, edit, or delete someone else's application
  it("hides, rejects edits to, and refuses deletes of another user's application", async () => {
    await asB(request(app).get(`/applications/${appA.id}`)).expect(404);
    await asB(request(app).put(`/applications/${appA.id}`))
      .send({ company_id: companyA.id, role_title: 'Hacked', status: 'saved' }).expect(404);
    await asB(request(app).delete(`/applications/${appA.id}`)).expect(404);

    const stillThere = await asA(request(app).get(`/applications/${appA.id}`)).expect(200);
    expect(stillThere.body.role_title).toBe('Engineer');
  });

  //Test 4: can't create an application under someone else's company
  it("cannot create an application under another user's company", async () => {
    await asB(request(app).post('/applications'))
      .send({ company_id: companyA.id, role_title: 'Sneaky', status: 'saved' }).expect(403);
  });

  it("cannot reassign own application to another user's company", async () => {
    const { application: appB } = await createCompanyAndApp(asB, 'Mine');
    await asB(request(app).put(`/applications/${appB.id}`))
      .send({ company_id: companyA.id, role_title: 'Engineer', status: 'saved' }).expect(404);
  });

  it("hides another user's interview stages", async () => {
    await asA(request(app).post('/interview_stages')).send({ application_id: appA.id, stage_name: 'Phone' }).expect(200);
    // a read of someone else's application returns nothing instead of an error
    expect((await asB(request(app).get(`/applications/${appA.id}/interview_stages`)).expect(200)).body).toEqual([]);
  });
});
