import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { pool } from '../db';
import { asA, asB } from '../testing/helpers';

describe('resumes', () => {
  it('returns null before a resume is saved', async () => {
    expect((await asA(request(app).get('/resumes')).expect(200)).body).toBeNull();
  });

  it('keeps one resume per user: saving again replaces the text and refreshes updated_at', async () => {
    const first = (await asA(request(app).put('/resumes')).send({ resume_text: 'v1' }).expect(200)).body;
    await new Promise((r) => setTimeout(r, 20));
    const second = (await asA(request(app).put('/resumes')).send({ resume_text: 'v2' }).expect(200)).body;

    expect(second.id).toBe(first.id);
    expect(second.resume_text).toBe('v2');
    expect(new Date(second.updated_at).getTime()).toBeGreaterThan(new Date(first.updated_at).getTime());
    expect((await pool.query('SELECT count(*)::int AS n FROM resumes')).rows[0].n).toBe(1);
  });

  it("never shows one user's resume to another", async () => {
    await asA(request(app).put('/resumes')).send({ resume_text: 'secret' }).expect(200);
    expect((await asB(request(app).get('/resumes')).expect(200)).body).toBeNull();
    await asB(request(app).put('/resumes')).send({ resume_text: 'mine' }).expect(200);
    expect((await asA(request(app).get('/resumes')).expect(200)).body.resume_text).toBe('secret');
  });

  it('rejects a request that has no resume text', async () => {
    await asA(request(app).put('/resumes')).send({}).expect(400);
    await asA(request(app).put('/resumes')).send({ resume_text: 123 }).expect(400);
  });

  it('allows saving an empty resume (clearing it)', async () => {
    await asA(request(app).put('/resumes')).send({ resume_text: '' }).expect(200);
  });
});
