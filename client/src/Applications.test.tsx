import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
vi.mock('./useError', () => ({ useError: () => ({ setErrorMessage: vi.fn() }) }));

import Applications from './Applications';

const companies = [{ id: 1, name: 'Acme', website: null, notes: null, created_at: '' }];
const existing = { id: 9, company_id: 1, role_title: 'Old', job_posting_url: null, status: 'saved', application_date: null, created_at: '', updated_at: '' };

function setup() {
  const setApplications = vi.fn();
  render(<MemoryRouter><Applications companies={companies} applications={[existing]} setApplications={setApplications} isLoading={false} /></MemoryRouter>);
  return { setApplications };
}
const fill = () => {
  fireEvent.change(screen.getByLabelText('Role Title'), { target: { value: 'Engineer' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: '1' } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: /add application/i }));

beforeEach(() => { apiFetch.mockReset(); });
afterEach(cleanup);

describe('Applications form', () => {
  it('sends status "saved" when the dropdown is left alone', async () => {
    apiFetch.mockResolvedValue({ ...existing, id: 10 });
    setup(); fill(); submit();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).status).toBe('saved');
  });

  it('keeps what was typed when the save fails', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    setup(); fill(); submit();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect((screen.getByLabelText('Role Title') as HTMLInputElement).value).toBe('Engineer');
  });

  it('clears the form after a successful save and keeps status on "saved"', async () => {
    apiFetch.mockResolvedValue({ ...existing, id: 10 });
    setup(); fill(); submit();
    await waitFor(() => expect((screen.getByLabelText('Role Title') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('saved');
  });

  it('adds the new application using the latest list (functional update)', async () => {
    apiFetch.mockResolvedValue({ ...existing, id: 10 });
    const { setApplications } = setup(); fill(); submit();
    await waitFor(() => expect(setApplications).toHaveBeenCalled());
    const update = setApplications.mock.calls[0][0];
    expect(typeof update).toBe('function');
    expect(update([existing]).map((a: { id: number }) => a.id)).toEqual([10, 9]);
  });
});
