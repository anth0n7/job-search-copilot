import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
// the same object every render, like the real context's stable setter (a new one each render would re-run effects)
vi.mock('./useError', () => {
  const value = { setErrorMessage: vi.fn() };
  return { useError: () => value };
});
// the sections fetch their own data; they are not what is being tested here
vi.mock('./InterviewStages', () => ({ default: () => null }));
vi.mock('./ApplicationContacts', () => ({ default: () => null }));
vi.mock('./JobPostings', () => ({ default: () => null }));
vi.mock('./Matches', () => ({ default: () => null }));
vi.mock('./Suggestions', () => ({ default: () => null }));

import ApplicationDetail from './ApplicationDetail';

const application = { id: 1, company_id: 1, role_title: 'Engineer', job_posting_url: null, status: 'saved', application_date: null, created_at: '', updated_at: '' };

function renderDetail(website: string | null) {
  apiFetch.mockResolvedValue(application);
  const companies = [{ id: 1, name: 'Acme', website, notes: null, created_at: '' }];
  render(
    <MemoryRouter initialEntries={['/applications/1']}>
      <Routes><Route path="/applications/:id" element={<ApplicationDetail companies={companies} />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { apiFetch.mockReset(); });
afterEach(cleanup);

describe('ApplicationDetail', () => {
  it('shows a dash instead of 1969 when there is no application date', async () => {
    renderDetail('https://acme.com');
    await screen.findByText(/Engineer at Acme/);
    expect(screen.queryByText(/1969|1970/)).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('makes a working link when the website has no https://', async () => {
    renderDetail('acme.com');
    const link = await screen.findByRole('link', { name: 'acme.com' });
    expect(link.getAttribute('href')).toBe('https://acme.com');
  });
});
