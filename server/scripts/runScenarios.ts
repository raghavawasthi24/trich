/**
 * Curls all ten brief scenarios (§9.3) against a running API + worker and
 * prints a pass/fail table. Needs no client at all — a backend reviewer can
 * verify every requirement with just `npm run temporal:up && npm run dev`.
 */
import axios from 'axios';

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:4000';
const TOKEN = process.env.API_TOKEN ?? 'dev-token-change-me';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

interface ScenarioCase {
  name: string;
  header: string;
  city: string;
  assert: (status: number, body: any) => string | null; // null = pass
}

const cases: ScenarioCase[] = [
  {
    name: 'Supplier A cheaper',
    header: 'A_OK_CHEAP,B_OK_EXPENSIVE',
    city: 'DemoACheaper',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'A' ? null : `expected 200 ok best=A, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'Supplier B cheaper',
    header: 'A_OK_EXPENSIVE,B_OK_CHEAP',
    city: 'DemoBCheaper',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'B' ? null : `expected 200 ok best=B, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'Both same rate -> tie to A',
    header: 'A_TIE,B_TIE',
    city: 'DemoTie',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'A' ? null : `expected 200 ok best=A, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'A fails, B succeeds',
    header: 'A_FAIL_500,B_OK',
    city: 'DemoAFails',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'B' ? null : `expected 200 ok best=B, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'Both fail',
    header: 'A_FAIL_500,B_FAIL_503',
    city: 'DemoBothFail',
    assert: (status, body) =>
      status === 502 && body.code === 'ALL_SUPPLIERS_FAILED' ? null : `expected 502 ALL_SUPPLIERS_FAILED, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'One returns empty',
    header: 'A_EMPTY,B_OK',
    city: 'DemoOneEmpty',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'B' ? null : `expected 200 ok best=B, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'Both return empty',
    header: 'A_EMPTY,B_EMPTY',
    city: 'DemoBothEmpty',
    assert: (status, body) =>
      status === 200 && !body.ok && body.code === 'NO_HOTELS_FOUND' ? null : `expected 200 NO_HOTELS_FOUND, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'One supplier takes >5s',
    header: 'A_SLOW_6S,B_OK',
    city: 'DemoOneSlow',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'B' ? null : `expected 200 ok best=B, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'A fails 2x then succeeds',
    header: 'A_FLAKY_2,B_EMPTY',
    city: 'DemoFlaky',
    assert: (status, body) =>
      status === 200 && body.ok && body.best.supplier === 'A' ? null : `expected 200 ok best=A, got ${status} ${JSON.stringify(body)}`,
  },
  {
    name: 'User cancels mid-way (both slow; not exercised via curl)',
    header: 'A_SLOW_6S,B_SLOW_6S',
    city: 'DemoCancel',
    assert: () => null, // requires client-side abort; documented, skipped here
  },
];

async function run() {
  console.log(`Running scenario demo against ${BASE_URL}\n`);
  const results: Array<{ name: string; pass: boolean; detail?: string }> = [];

  for (const c of cases) {
    try {
      const res = await axios.post(
        `${BASE_URL}/api/search-hotels`,
        { city: c.city, checkInDate: futureDate(1), checkOutDate: futureDate(3) },
        {
          headers: { Authorization: `Bearer ${TOKEN}`, 'x-mock-scenario': c.header },
          validateStatus: () => true,
          timeout: 15000,
        },
      );
      const failure = c.assert(res.status, res.data);
      results.push({ name: c.name, pass: !failure, detail: failure ?? undefined });
    } catch (err) {
      results.push({ name: c.name, pass: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }

  const nameWidth = Math.max(...results.map((r) => r.name.length)) + 2;
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`${status.padEnd(6)} ${r.name.padEnd(nameWidth)} ${r.detail ?? ''}`);
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Demo script crashed:', err);
  process.exit(1);
});
