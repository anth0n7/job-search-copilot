import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('./useApi', () => ({ useApi: () => apiFetch }));
vi.mock('./useError', () => ({ useError: () => ({ setErrorMessage: vi.fn() }) }));

import InterviewStages from './InterviewStages';

const stage = { id: 5, application_id: 1, stage_name: 'Phone', scheduled_date: '2026-11-09T15:00:00.000Z', completed: false, notes: null };

beforeEach(() => { apiFetch.mockReset(); });
afterEach(cleanup);

describe('InterviewStages', () => {
  it('shows the saved time in the edit box, in local time', async () => {
    apiFetch.mockResolvedValue([stage]);
    render(<InterviewStages applicationID={1} />);
    fireEvent.click(await screen.findByText('Edit Interview Stage'));
    // TZ is America/New_York in tests, so 15:00 UTC is 10:00 local
    expect((screen.getByLabelText('Scheduled Date') as HTMLInputElement).value).toBe('2026-11-09T10:00');
  });

  it('sends the time back as the same UTC moment when saving', async () => {
    apiFetch.mockResolvedValueOnce([stage]).mockResolvedValue(stage);
    render(<InterviewStages applicationID={1} />);
    fireEvent.click(await screen.findByText('Edit Interview Stage'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(apiFetch.mock.calls[1][1].body).scheduled_date).toBe('2026-11-09T15:00:00.000Z');
  });

  it('requires a stage name', async () => {
    apiFetch.mockResolvedValue([]);
    render(<InterviewStages applicationID={1} />);
    fireEvent.click(await screen.findByText('Add Interview Stage', { selector: 'button' }));
    expect((screen.getByLabelText('Stage Name') as HTMLInputElement).required).toBe(true);
  });

  it('keeps the form open and filled when saving fails', async () => {
    apiFetch.mockResolvedValueOnce([]).mockRejectedValue(new Error('boom'));
    render(<InterviewStages applicationID={1} />);
    fireEvent.click(await screen.findByText('Add Interview Stage', { selector: 'button' }));
    fireEvent.change(screen.getByLabelText('Stage Name'), { target: { value: 'Onsite' } });
    fireEvent.click(screen.getAllByRole('button', { name: /add interview stage/i }).at(-1)!);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 10));
    expect((screen.getByLabelText('Stage Name') as HTMLInputElement).value).toBe('Onsite');
  });
});
