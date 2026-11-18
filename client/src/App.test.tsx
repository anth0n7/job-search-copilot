import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Fake Clerk: the test flips `auth` to sign in and out
const auth = { isLoaded: true, isSignedIn: false };
vi.mock('@clerk/react', () => ({
  useAuth: () => auth,
  Show: () => null, SignInButton: () => null, SignUpButton: () => null, UserButton: () => null,
}));
const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
// the same object every render, like the real context's stable setter (a new one each render would re-run effects)
vi.mock('./useError', () => {
  const value = { setErrorMessage: vi.fn() };
  return { useError: () => value };
});
vi.mock('./ErrorBanner', () => ({ default: () => null }));
vi.mock('./Companies', () => ({ default: (p: { companies: unknown[] }) => <p>companies:{p.companies.length}</p> }));
vi.mock('./Applications', () => ({ default: () => null }));
vi.mock('./Resumes', () => ({ default: () => null }));
vi.mock('./ApplicationDetail', () => ({ default: () => null }));

import App from './App';

const tree = () => <MemoryRouter initialEntries={['/companies']}><App /></MemoryRouter>;

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue([{ id: 1 }]);
  auth.isLoaded = true; auth.isSignedIn = false;
});
afterEach(cleanup);

describe('App data loading', () => {
  it('does not call the API while signed out', async () => {
    render(tree());
    await new Promise((r) => setTimeout(r, 20));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('loads data after signing in', async () => {
    const view = render(tree());
    auth.isSignedIn = true;
    view.rerender(tree());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/companies'));
    expect(apiFetch).toHaveBeenCalledWith('/applications');
  });

  it('clears the data after signing out', async () => {
    auth.isSignedIn = true;
    const view = render(tree());
    await waitFor(() => view.getByText('companies:1'));
    auth.isSignedIn = false;
    view.rerender(tree());
    await waitFor(() => view.getByText('companies:0'));
  });
});
