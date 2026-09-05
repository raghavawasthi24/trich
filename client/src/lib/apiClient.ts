import { env } from '../config/env';
import type { SearchRequest, SearchResponse } from '../types/api';

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface SearchOptions {
  signal?: AbortSignal;
  scenario?: string;
}

function requestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function searchHotels(body: SearchRequest, options: SearchOptions = {}): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}/api/search-hotels`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.VITE_API_TOKEN}`,
        'x-request-id': requestId(),
        ...(options.scenario ? { 'x-mock-scenario': options.scenario } : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new NetworkError();
  }

  const data = (await response.json()) as SearchResponse;
  return data;
}

export async function getSearchStatus(searchId: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${env.VITE_API_BASE_URL}/api/search-hotels/${encodeURIComponent(searchId)}`, {
    headers: { authorization: `Bearer ${env.VITE_API_TOKEN}` },
    signal,
  });
  return response.json();
}
