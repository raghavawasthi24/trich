import { expect, test } from '@playwright/test';
import { SearchResponseSchema } from '../../src/schemas/searchForm.schema';

/**
 * Asserts the live server's response shape still matches what the client
 * expects (src/types/api.ts). Catches drift between the server's authoritative
 * schema and this hand-maintained mirror before it ships as `undefined` in the UI.
 */
test('contract: live /api/search-hotels response matches the client type mirror', async ({ request }) => {
  const apiBase = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
  const token = process.env.E2E_API_TOKEN ?? 'dev-token-change-me';

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 1);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + 3);

  const res = await request.post(`${apiBase}/api/search-hotels`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-mock-scenario': 'A_OK_CHEAP,B_OK_EXPENSIVE',
    },
    data: {
      city: 'ContractTestCity',
      checkInDate: checkIn.toISOString().slice(0, 10),
      checkOutDate: checkOut.toISOString().slice(0, 10),
    },
  });

  const body = await res.json();
  const result = SearchResponseSchema.safeParse(body);

  expect(result.success, `Response failed the client contract schema: ${JSON.stringify(result.error?.issues)}`).toBe(
    true,
  );
});
