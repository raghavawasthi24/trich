import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchPage } from '../../src/pages/SearchPage';
import { server } from '../helpers/mswServer';
import { allFailedResponse, emptyResponse, handlerWithDelay, handlerWithResponse } from '../helpers/mswHandlers';
import { renderWithProviders, futureDateInput } from '../helpers/renderWithProviders';

async function fillValidForm() {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('City'));
  await user.type(screen.getByLabelText('City'), 'Goa');
  fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: futureDateInput(1) } });
  fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: futureDateInput(3) } });
  return user;
}

describe('SearchPage form validation', () => {
  it('shows an inline error and never calls fetch when check-out is before check-in', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();

    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: futureDateInput(-1) } });
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    expect(await screen.findByText('Check-out must be after check-in')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('SearchPage loading state', () => {
  it('shows a spinner and disables the submit button while the request is in flight', async () => {
    server.use(handlerWithDelay(500));
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByTestId('result-card')).toBeInTheDocument(), { timeout: 2000 });
  });
});

describe('SearchPage success render', () => {
  it('renders the hotel name, formatted price, and supplier badge', async () => {
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    const card = await screen.findByTestId('result-card');
    expect(card).toHaveTextContent('Seaside Palms Resort');
    expect(card).toHaveTextContent('₹8,450.00');
    expect(card).toHaveTextContent('Supplier A');
  });
});

describe('SearchPage empty render', () => {
  it('renders a neutral empty state for NO_HOTELS_FOUND, not an error style', async () => {
    server.use(handlerWithResponse(emptyResponse, 200));
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });
});

describe('SearchPage error render', () => {
  it('renders an error banner with a retry button for ALL_SUPPLIERS_FAILED', async () => {
    server.use(handlerWithResponse(allFailedResponse, 502));
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    const banner = await screen.findByTestId('error-banner');
    expect(banner).toHaveTextContent('Both suppliers are currently unavailable');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('SearchPage cancel', () => {
  it('returns to an idle-like cancelled state on abort with no state-update warning', async () => {
    server.use(handlerWithDelay(2000));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<SearchPage />);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: /search hotels/i }));

    await screen.findByTestId('loading-state');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByTestId('cancelled-note')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('not wrapped in act'));
    consoleError.mockRestore();
  });
});
