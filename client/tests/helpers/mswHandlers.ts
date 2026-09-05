import { http, HttpResponse, delay, type JsonBodyType } from 'msw';

const BASE_URL = 'http://localhost:4000';

export const successResponse = {
  ok: true,
  searchId: 'search:abc123',
  best: {
    hotelId: 'A-1042',
    name: 'Seaside Palms Resort',
    priceMinor: 845000,
    priceFormatted: '₹8,450.00',
    currency: 'INR',
    supplier: 'A',
  },
  consideredCount: 7,
  suppliers: [
    { supplier: 'A', status: 'ok', offerCount: 4, latencyMs: 412 },
    { supplier: 'B', status: 'ok', offerCount: 3, latencyMs: 380 },
  ],
  durationMs: 512,
  requestId: 'req-1',
};

export const emptyResponse = {
  ok: false,
  code: 'NO_HOTELS_FOUND',
  message: 'No hotels found for Goa on those dates.',
  searchId: 'search:abc123',
  suppliers: [
    { supplier: 'A', status: 'empty', offerCount: 0 },
    { supplier: 'B', status: 'empty', offerCount: 0 },
  ],
  requestId: 'req-1',
};

export const allFailedResponse = {
  ok: false,
  code: 'ALL_SUPPLIERS_FAILED',
  message: 'Both suppliers are currently unavailable. Please try again.',
  searchId: 'search:abc123',
  requestId: 'req-1',
};

export const handlers = [
  http.post(`${BASE_URL}/api/search-hotels`, () => HttpResponse.json(successResponse)),
];

export function handlerWithDelay(ms: number) {
  return http.post(`${BASE_URL}/api/search-hotels`, async () => {
    await delay(ms);
    return HttpResponse.json(successResponse);
  });
}

export function handlerWithResponse(body: JsonBodyType, status = 200) {
  return http.post(`${BASE_URL}/api/search-hotels`, () => HttpResponse.json(body, { status }));
}
