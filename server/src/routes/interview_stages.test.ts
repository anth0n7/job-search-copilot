import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { asA, asB } from '../testing/helpers';

let appA: { id: number };
let appB: { id: number };

async function createApplication(as: typeof asA, companyName: string) {
  const company = (await as(request(app).post('/companies')).send({ name: companyName }).expect(200)).body;
  return (await as(request(app).post('/applications')).send({ company_id: company.id, role_title: 'Engineer', status: 'saved' }).expect(200)).body;
}

beforeEach(async () => {
  appA = await createApplication(asA, 'Acme');
  appB = await createApplication(asB, 'Beta');
});

const createStage = (name: string, applicationId = appA.id, as = asA) =>
  as(request(app).post('/interview_stages')).send({ application_id: applicationId, stage_name: name, scheduled_date: null, completed: false, notes: null });

describe('interview stages', () => {
  it("creates stages and lists only the caller's, newest first", async () => {
    await createStage('First').expect(200);
    await createStage('Second').expect(200);
    await createStage('Theirs', appB.id, asB).expect(200);
    const list = (await asA(request(app).get('/interview_stages')).expect(200)).body;
    expect(list.map((s: { stage_name: string }) => s.stage_name)).toEqual(['Second', 'First']);
  });

  it("cannot create a stage under another user's application", async () => {
    await createStage('Sneaky', appB.id).expect(404);
  });

  it("hides, refuses to edit and refuses to delete another user's stage", async () => {
    const { id } = (await createStage('Mine').expect(200)).body;
    await asB(request(app).get(`/interview_stages/${id}`)).expect(404);
    await asB(request(app).put(`/interview_stages/${id}`)).send({ application_id: appB.id, stage_name: 'Hacked' }).expect(404);
    await asB(request(app).delete(`/interview_stages/${id}`)).expect(404);
    expect((await asA(request(app).get(`/interview_stages/${id}`)).expect(200)).body.stage_name).toBe('Mine');
  });

  it("cannot move own stage to another user's application", async () => {
    const { id } = (await createStage('Mine').expect(200)).body;
    await asA(request(app).put(`/interview_stages/${id}`)).send({ application_id: appB.id, stage_name: 'Mine' }).expect(404);
    expect((await asA(request(app).get(`/interview_stages/${id}`)).expect(200)).body.application_id).toBe(appA.id);
  });

  it('edits and deletes own stage', async () => {
    const { id } = (await createStage('Old').expect(200)).body;
    const edited = await asA(request(app).put(`/interview_stages/${id}`)).send({ application_id: appA.id, stage_name: 'New', completed: true, notes: 'x' }).expect(200);
    expect(edited.body).toMatchObject({ stage_name: 'New', completed: true, notes: 'x' });
    await asA(request(app).delete(`/interview_stages/${id}`)).expect(200);
    await asA(request(app).get(`/interview_stages/${id}`)).expect(404);
  });

  it('is removed when its application is deleted', async () => {
    const { id } = (await createStage('Doomed').expect(200)).body;
    await asA(request(app).delete(`/applications/${appA.id}`)).expect(200);
    await asA(request(app).get(`/interview_stages/${id}`)).expect(404);
  });

  it('answers 404 (not a server error) for an id that is not a number', async () => {
    await asA(request(app).get('/interview_stages/abc')).expect(404);
    await asA(request(app).put('/interview_stages/abc')).send({ application_id: appA.id, stage_name: 'x' }).expect(404);
    await asA(request(app).delete('/interview_stages/abc')).expect(404);
  });
});
