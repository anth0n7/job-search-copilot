import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
// the same object every render, like the real context's stable setter (a new one each render would re-run effects)
vi.mock('./useError', () => {
  const value = { setErrorMessage: vi.fn() };
  return { useError: () => value };
});
vi.mock('./CompanyContacts', () => ({ default: () => null }));

import Companies from './Companies';

const company = { id: 1, name: 'Acme', website: null, notes: null, created_at: '' };
function setup() {
  const setCompanies = vi.fn();
  render(<Companies companies={[company]} applications={[]} setCompanies={setCompanies} onCompanyDeleted={() => {}} isLoading={false} />);
  return { setCompanies };
}

beforeEach(() => { apiFetch.mockReset(); });
afterEach(cleanup);

describe('Companies', () => {
  it('keeps what was typed when adding fails', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    setup();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'NewCo' } });
    fireEvent.click(screen.getByRole('button', { name: /add company/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('NewCo');
  });

  it('adds the new company using the latest list (functional update)', async () => {
    apiFetch.mockResolvedValue({ ...company, id: 2 });
    const { setCompanies } = setup();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'NewCo' } });
    fireEvent.click(screen.getByRole('button', { name: /add company/i }));
    await waitFor(() => expect(setCompanies).toHaveBeenCalled());
    expect(typeof setCompanies.mock.calls[0][0]).toBe('function');
  });

  it('makes the edit-modal name a required field inside a real form', () => {
    setup();
    fireEvent.click(screen.getByText('Acme'));
    const input = screen.getByLabelText('Name:') as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.form).not.toBeNull();
  });
});
