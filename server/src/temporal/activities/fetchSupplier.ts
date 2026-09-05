import axios, { AxiosError } from 'axios';
import { Context } from '@temporalio/activity';
import { env } from '../../config/env';
import { classifySupplierError, SupplierMalformedResponseError } from '../../domain/supplierErrors';
import { SupplierActivitySuccess } from '../../domain/normalizeOffers';
import { SearchWorkflowInput } from '../../types/api.types';

const MAX_OFFERS_RETURNED = 200;

function coerceHotels(data: unknown): unknown[] {
  if (data && typeof data === 'object' && 'hotels' in data) {
    const hotels = (data as { hotels: unknown }).hotels;
    if (Array.isArray(hotels)) return hotels;
    if (hotels && typeof hotels === 'object') return [hotels];
    return [];
  }
  return [];
}

function priceOf(h: unknown): number {
  const p = h && typeof h === 'object' ? (h as { price?: unknown }).price : undefined;
  return typeof p === 'number' && Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
}

export async function fetchSupplier(
  supplier: 'A' | 'B',
  url: string,
  input: SearchWorkflowInput,
): Promise<SupplierActivitySuccess> {
  const ctx = Context.current();
  const workflowId = ctx.info.workflowExecution?.workflowId ?? ctx.info.activityId;

  const heartbeatTimer = setInterval(() => ctx.heartbeat(), 1000);

  try {
    let response;
    try {
      response = await axios.get(url, {
        params: { city: input.city, checkIn: input.checkInDate, checkOut: input.checkOutDate, adults: input.adults },
        timeout: env.SUPPLIER_TIMEOUT_MS,
        signal: ctx.cancellationSignal as unknown as AbortSignal,
        headers: {
          ...(input.scenario ? { 'x-mock-scenario': input.scenario } : {}),
          'x-request-id': workflowId,
        },
        validateStatus: () => true,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.message && /JSON/i.test(axiosErr.message)) {
        throw new SupplierMalformedResponseError(supplier, 'Supplier returned invalid JSON');
      }
      throw classifySupplierError(supplier, {
        code: axiosErr.code,
        response: axiosErr.response
          ? { status: axiosErr.response.status, headers: axiosErr.response.headers as Record<string, string> }
          : undefined,
      });
    }

    if (response.status >= 400) {
      throw classifySupplierError(supplier, {
        response: { status: response.status, headers: response.headers as Record<string, string> },
      });
    }

    if (typeof response.data === 'string') {
      throw new SupplierMalformedResponseError(supplier, 'Supplier returned invalid JSON');
    }

    let hotels = coerceHotels(response.data);
    if (hotels.length > MAX_OFFERS_RETURNED) {
      hotels = [...hotels].sort((a, b) => priceOf(a) - priceOf(b)).slice(0, MAX_OFFERS_RETURNED);
    }

    return { supplier, hotels, latencyMs: response.data?.latencyMs ?? 0 };
  } finally {
    clearInterval(heartbeatTimer);
  }
}
