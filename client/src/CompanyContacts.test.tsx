import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
// the same object every render, like the real context's stable setter (a new one each render would re-run effects)
vi.mock('./useError', () => {
  const value = { setErrorMessage: vi.fn() };
  return { useError: () => value };
});

import CompanyContacts from './CompanyContacts';

beforeEach(() => { apiFetch.mockReset(); });
afterEach(cleanup);

describe('CompanyContacts', () => {
  it('requires a contact name', async () => {
    apiFetch.mockResolvedValue([]);
    render(<CompanyContacts companyID={1} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect((screen.getByLabelText('Name') as HTMLInputElement).required).toBe(true);
  });

  it('keeps what was typed when saving fails', async () => {
    apiFetch.mockResolvedValueOnce([]).mockRejectedValue(new Error('boom'));
    render(<CompanyContacts companyID={1} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pat' } });
    fireEvent.click(screen.getByRole('button', { name: /add contact/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 10));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Pat');
  });
});
