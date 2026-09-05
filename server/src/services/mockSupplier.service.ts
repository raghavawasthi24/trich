import { sha1 } from '../helpers/hash';
import { ScenarioToken, ScenarioMap, SupplierId } from '../helpers/scenario';
import { env } from '../config/env';

const NAME_POOL = [
  'Resort',
  'Inn',
  'Heritage',
  'Palace',
  'Suites',
  'Grand Hotel',
  'Boutique Stay',
  'Residency',
];

export interface RawHotel {
  hotelId: string | null;
  name: string | null;
  price: number | string;
  currency?: string;
}

export interface ScenarioOutcome {
  httpStatus: number;
  delayMs: number;
  kind: 'json' | 'malformed_text' | 'hang';
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

function seededRng(seedStr: string): () => number {
  let seed = parseInt(sha1(seedStr).slice(0, 8), 16);
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function supplierOffset(city: string, supplier: SupplierId): number {
  if (supplier === 'A') return 1;
  const h = parseInt(sha1(city.toLowerCase()).slice(0, 2), 16);
  return h % 2 === 0 ? 0.92 : 1.08;
}

export function buildCatalogue(city: string, supplier: SupplierId): RawHotel[] {
  const rng = seededRng(`${city.toLowerCase()}|${supplier}`);
  const count = 3 + Math.floor(rng() * 5);
  const offset = supplierOffset(city, supplier);
  return Array.from({ length: count }, (_, i) => ({
    hotelId: `${supplier}-${1000 + i}`,
    name: `${titleCase(city)} ${NAME_POOL[Math.floor(rng() * NAME_POOL.length)]}`,
    price: round2((4000 + rng() * 8000) * offset),
    currency: 'INR',
  }));
}

// --- FLAKY_* attempt counters (in-memory, test-only reset via POST /mock/reset) ---
const attemptCounters = new Map<string, number>();

export function nextAttempt(key: string): number {
  const n = (attemptCounters.get(key) ?? 0) + 1;
  attemptCounters.set(key, n);
  return n;
}

export function resetAttemptCounters(): void {
  attemptCounters.clear();
}

const WEIGHTED_BEHAVIORS: Array<{ token: ScenarioToken; weight: number }> = [
  { token: 'OK', weight: 60 },
  { token: 'SLOW_2S', weight: 15 },
  { token: 'TIMEOUT', weight: 8 },
  { token: 'EMPTY', weight: 7 },
  { token: 'FAIL_500', weight: 4 },
  { token: 'FAIL_503', weight: 4 },
  { token: 'MALFORMED_JSON', weight: 1 },
  { token: 'MALFORMED_SHAPE', weight: 1 },
];

function pickWeighted(rng: () => number): ScenarioToken {
  const total = WEIGHTED_BEHAVIORS.reduce((s, b) => s + b.weight, 0);
  let r = rng() * total;
  for (const b of WEIGHTED_BEHAVIORS) {
    r -= b.weight;
    if (r <= 0) return b.token;
  }
  return 'OK';
}

export function resolveToken(scenarioMap: ScenarioMap, supplier: SupplierId, seed: string): ScenarioToken {
  const forced = scenarioMap[supplier];
  if (forced) return forced;
  if (!env.MOCK_CHAOS_ENABLED) return 'OK';
  return pickWeighted(seededRng(`${seed}|chaos`));
}

function errorBody(supplier: SupplierId, error: string, message: string) {
  return { error, message, supplier };
}

export function applyScenario(
  token: ScenarioToken,
  city: string,
  supplier: SupplierId,
  attemptKey: string,
): ScenarioOutcome {
  const base = buildCatalogue(city, supplier);
  const requestedCity = city;

  switch (token) {
    case 'OK':
      return {
        httpStatus: 200,
        delayMs: 150,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base, latencyMs: 150 },
      };

    case 'OK_CHEAP':
      return {
        httpStatus: 200,
        delayMs: 150,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: `${supplier}-9000`, name: 'Bargain Stay', price: 1500.0, currency: 'INR' }, ...base],
          latencyMs: 150,
        },
      };

    case 'OK_EXPENSIVE':
      return {
        httpStatus: 200,
        delayMs: 150,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: base.map((h) => ({ ...h, price: round2((h.price as number) * 1.5) })),
          latencyMs: 150,
        },
      };

    case 'TIE':
      return {
        httpStatus: 200,
        delayMs: 150,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: `${supplier}-1000`, name: 'Tie Break Hotel', price: 7500.0, currency: 'INR' }],
          latencyMs: 150,
        },
      };

    case 'EMPTY':
      return {
        httpStatus: 200,
        delayMs: 100,
        kind: 'json',
        body: { supplier, requestedCity, hotels: [], latencyMs: 100 },
      };

    case 'SLOW_2S':
      return {
        httpStatus: 200,
        delayMs: 2000,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base, latencyMs: 2000 },
      };

    case 'SLOW_6S':
      return {
        httpStatus: 200,
        delayMs: 6000,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base, latencyMs: 6000 },
      };

    case 'TIMEOUT':
      return { httpStatus: 200, delayMs: 30000, kind: 'hang' };

    case 'FAIL_500':
      return {
        httpStatus: 500,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierServerError', 'Upstream inventory service unavailable'),
      };

    case 'FAIL_503':
      return {
        httpStatus: 503,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierServerError', 'Service temporarily unavailable'),
        headers: { 'retry-after': '1' },
      };

    case 'FAIL_429':
      return {
        httpStatus: 429,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierRateLimited', 'Too many requests'),
        headers: { 'retry-after': '1' },
      };

    case 'FAIL_400':
      return {
        httpStatus: 400,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierBadRequestError', 'Invalid request parameters'),
      };

    case 'FAIL_401':
      return {
        httpStatus: 401,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierAuthError', 'Invalid credentials'),
      };

    case 'FLAKY_2': {
      const attempt = nextAttempt(attemptKey);
      if (attempt <= 2) {
        return {
          httpStatus: 500,
          delayMs: 50,
          kind: 'json',
          body: errorBody(supplier, 'SupplierServerError', `Flaky failure (attempt ${attempt})`),
        };
      }
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base, latencyMs: 50 },
      };
    }

    case 'FLAKY_4': {
      const attempt = nextAttempt(attemptKey);
      return {
        httpStatus: 500,
        delayMs: 50,
        kind: 'json',
        body: errorBody(supplier, 'SupplierServerError', `Flaky failure (attempt ${attempt})`),
      };
    }

    case 'MALFORMED_JSON':
      return { httpStatus: 200, delayMs: 50, kind: 'malformed_text', text: '{ not json' };

    case 'MALFORMED_SHAPE':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: { supplier, requestedCity, hotels: [{ nombre: 'x' }], latencyMs: 50 },
      };

    case 'NEGATIVE_PRICE':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: `${supplier}-9001`, name: 'Bad Price Hotel', price: -100, currency: 'INR' }, ...base],
          latencyMs: 50,
        },
      };

    case 'ZERO_PRICE':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: `${supplier}-9002`, name: 'Zero Price Hotel', price: 0, currency: 'INR' }, ...base],
          latencyMs: 50,
        },
      };

    case 'NAN_PRICE':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: `${supplier}-9003`, name: 'NaN Price Hotel', price: 'abc', currency: 'INR' }, ...base],
          latencyMs: 50,
        },
      };

    case 'WRONG_CURRENCY':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base.map((h) => ({ ...h, currency: 'USD' })), latencyMs: 50 },
      };

    case 'DUPLICATE_IDS':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [
            { hotelId: `${supplier}-1000`, name: 'First Copy', price: 5000, currency: 'INR' },
            { hotelId: `${supplier}-1000`, name: 'Second Copy', price: 5100, currency: 'INR' },
          ],
          latencyMs: 50,
        },
      };

    case 'HUGE_PAYLOAD': {
      const rng = seededRng(`${city}|${supplier}|huge`);
      const hotels = Array.from({ length: 10000 }, (_, i) => ({
        hotelId: `${supplier}-huge-${i}`,
        name: `${titleCase(city)} Bulk Hotel ${i}`,
        price: round2(3000 + rng() * 9000),
        currency: 'INR',
      }));
      return { httpStatus: 200, delayMs: 300, kind: 'json', body: { supplier, requestedCity, hotels, latencyMs: 300 } };
    }

    case 'SINGLE_OBJECT':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base[0], latencyMs: 50 },
      };

    case 'NULL_FIELDS':
      return {
        httpStatus: 200,
        delayMs: 50,
        kind: 'json',
        body: {
          supplier,
          requestedCity,
          hotels: [{ hotelId: null, name: null, price: 5000, currency: 'INR' }, ...base],
          latencyMs: 50,
        },
      };

    default:
      return {
        httpStatus: 200,
        delayMs: 150,
        kind: 'json',
        body: { supplier, requestedCity, hotels: base, latencyMs: 150 },
      };
  }
}
