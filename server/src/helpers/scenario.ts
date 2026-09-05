export type SupplierId = 'A' | 'B';

export const SCENARIO_TOKENS = [
  'OK',
  'OK_CHEAP',
  'OK_EXPENSIVE',
  'TIE',
  'EMPTY',
  'SLOW_2S',
  'SLOW_6S',
  'TIMEOUT',
  'FAIL_500',
  'FAIL_503',
  'FAIL_429',
  'FAIL_400',
  'FAIL_401',
  'FLAKY_2',
  'FLAKY_4',
  'MALFORMED_JSON',
  'MALFORMED_SHAPE',
  'NEGATIVE_PRICE',
  'ZERO_PRICE',
  'NAN_PRICE',
  'WRONG_CURRENCY',
  'DUPLICATE_IDS',
  'HUGE_PAYLOAD',
  'SINGLE_OBJECT',
  'NULL_FIELDS',
] as const;

export type ScenarioToken = (typeof SCENARIO_TOKENS)[number];

export type ScenarioMap = Partial<Record<SupplierId, ScenarioToken>>;

function isScenarioToken(v: string): v is ScenarioToken {
  return (SCENARIO_TOKENS as readonly string[]).includes(v);
}

/**
 * Parses "A_FAIL_500,B_OK" (from a header or a magic city keyword segment)
 * into { A: 'FAIL_500', B: 'OK' }. Unknown/malformed tokens are ignored.
 */
export function parseScenarioString(raw: string): ScenarioMap {
  const map: ScenarioMap = {};
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    const match = /^([AB])_(.+)$/.exec(trimmed);
    if (!match) continue;
    const [, supplier, token] = match;
    if (isScenarioToken(token)) {
      map[supplier as SupplierId] = token;
    }
  }
  return map;
}

/**
 * City keyword form: "goa__A_TIMEOUT__B_OK" -> scenario map (city part ignored).
 * Reserved city "tiecity" forces TIE on both suppliers if no explicit tokens present.
 */
function parseCityKeyword(city: string): ScenarioMap {
  const lower = city.toLowerCase();
  if (lower.includes('__')) {
    const parts = lower.split('__').slice(1).join(',').toUpperCase();
    return parseScenarioString(parts);
  }
  if (lower === 'failcity') {
    return { A: 'FAIL_500', B: 'FAIL_503' };
  }
  if (lower === 'tiecity') {
    return { A: 'TIE', B: 'TIE' };
  }
  return {};
}

/**
 * Resolution priority: header > magic city keyword > {} (caller falls back to weighted random).
 */
export function parseScenario(header: string | undefined | null, city: string): ScenarioMap {
  if (header && header.trim().length > 0) {
    const fromHeader = parseScenarioString(header.toUpperCase());
    if (Object.keys(fromHeader).length > 0) return fromHeader;
  }
  return parseCityKeyword(city);
}
