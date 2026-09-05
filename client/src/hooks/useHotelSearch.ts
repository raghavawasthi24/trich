import { useCallback, useEffect, useRef, useState } from 'react';
import { getSearchStatus, NetworkError, searchHotels } from '../lib/apiClient';
import { messageFor } from '../lib/errorMessages';
import type { ErrorCode, SearchRequest, SearchSuccessResponse, SupplierReportRow } from '../types/api';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'polling'; searchId: string }
  | { status: 'success'; data: SearchSuccessResponse }
  | { status: 'empty'; message: string; suppliers: SupplierReportRow[] }
  | { status: 'error'; code: ErrorCode; message: string }
  | { status: 'cancelled' };

const POLL_MAX_ATTEMPTS = 6;

export function useHotelSearch() {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(
    () => {
      // React 18 StrictMode dev-mode mounts, unmounts, and remounts once;
      // the cleanup below runs on that simulated unmount, so mountedRef must
      // be reset to true here or every state update after it becomes a no-op.
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        controllerRef.current?.abort();
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      };
    },
    [],
  );

  const safeSetState = useCallback((next: SearchState) => {
    if (mountedRef.current) setState(next);
  }, []);

  const pollForResult = useCallback(
    (searchId: string, signal: AbortSignal, attempt: number) => {
      if (attempt >= POLL_MAX_ATTEMPTS) {
        safeSetState({ status: 'error', code: 'SEARCH_TIMEOUT', message: messageFor('SEARCH_TIMEOUT') });
        return;
      }

      pollTimerRef.current = setTimeout(async () => {
        if (signal.aborted) return;
        try {
          const data = (await getSearchStatus(searchId, signal)) as
            | SearchSuccessResponse
            | { ok: false; code: ErrorCode; message?: string; suppliers?: SupplierReportRow[] };

          if (data.ok) {
            safeSetState({ status: 'success', data: data as SearchSuccessResponse });
            return;
          }
          if (data.code === 'SEARCH_PENDING') {
            pollForResult(searchId, signal, attempt + 1);
            return;
          }
          if (data.code === 'NO_HOTELS_FOUND') {
            safeSetState({ status: 'empty', message: messageFor(data.code, data.message), suppliers: data.suppliers ?? [] });
            return;
          }
          safeSetState({ status: 'error', code: data.code, message: messageFor(data.code, data.message) });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            safeSetState({ status: 'cancelled' });
            return;
          }
          safeSetState({ status: 'error', code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') });
        }
      }, 1500);
    },
    [safeSetState],
  );

  const search = useCallback(
    async (input: SearchRequest, scenario?: string) => {
      controllerRef.current?.abort();
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

      const controller = new AbortController();
      controllerRef.current = controller;
      safeSetState({ status: 'loading' });

      try {
        const res = await searchHotels(input, { signal: controller.signal, scenario });

        if (res.ok) {
          safeSetState({ status: 'success', data: res });
          return;
        }
        if (res.code === 'SEARCH_PENDING' && res.searchId) {
          safeSetState({ status: 'polling', searchId: res.searchId });
          pollForResult(res.searchId, controller.signal, 0);
          return;
        }
        if (res.code === 'NO_HOTELS_FOUND') {
          safeSetState({ status: 'empty', message: messageFor(res.code, res.message), suppliers: [] });
          return;
        }
        safeSetState({ status: 'error', code: res.code, message: messageFor(res.code, res.message) });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          safeSetState({ status: 'cancelled' });
          return;
        }
        if (err instanceof NetworkError) {
          safeSetState({ status: 'error', code: 'INTERNAL_ERROR', message: 'You appear to be offline.' });
          return;
        }
        safeSetState({ status: 'error', code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') });
      }
    },
    [pollForResult, safeSetState],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const reset = useCallback(() => safeSetState({ status: 'idle' }), [safeSetState]);

  return { state, search, cancel, reset };
}
