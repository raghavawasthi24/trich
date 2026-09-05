# Hotel Rate Comparator — Server

Standalone backend: Express API + a Temporal workflow that fans out to two mock supplier APIs and returns the cheapest offer. Independent npm project — no workspace link to `client/`.

## Quickstart

```bash
cp .env.example .env
npm install
npm run temporal:up      # Temporal + Postgres + Web UI (localhost:8080)
npm run dev               # api :4000 + worker, both watching
```

Verify the backend alone, no frontend needed:

```bash
npm run demo:scenarios
```

## Entry points

- `src/api.ts` — Express server (port 4000): the search API, health check, and the two mock supplier endpoints.
- `src/worker.ts` — Temporal worker: polls the `hotel-search` task queue and runs `hotelSearchWorkflow`.

Both processes share the same codebase but are started, and would scale, independently.

## Testing

```bash
npm test              # everything, with coverage
npm run test:unit      # domain/schema/error-mapping logic, no I/O
npm run test:workflow  # hotelSearchWorkflow via TestWorkflowEnvironment (time-skipping)
npm run test:int       # real Temporal test server + worker + Express app via Supertest
```

`test:workflow` and `test:int` download a small embedded Temporal test-server binary on first run (no Docker required for tests — Docker is only needed for `npm run dev` against a real Temporal server).

## Forcing supplier behavior

Every scenario in the brief can be triggered on demand — no waiting on random chance:

```bash
curl -X POST localhost:4000/api/search-hotels \
  -H "Authorization: Bearer dev-token-change-me" \
  -H "Content-Type: application/json" \
  -H "x-mock-scenario: A_FAIL_500,B_OK" \
  -d '{"city":"Goa","checkInDate":"2026-10-01","checkOutDate":"2026-10-04"}'
```

See `src/helpers/scenario.ts` for the full token catalogue and `src/services/mockSupplier.service.ts` for how each one is applied.

## Known limitations

See the root README for the full list (auth, contract duplication, rate limiting, etc.). Server-specific:

- Workflow coverage isn't reflected in Istanbul's report — workflow code runs inside Temporal's sandboxed V8 isolate, not the Jest-instrumented process, even though `tests/workflow` exercises every required scenario (B1–B7, A1–A3).
- `AUTH_DISABLED`/`MOCK_CHAOS_ENABLED` are parsed as `"true"`/`"false"` text in `src/config/env.ts` rather than via `z.coerce.boolean()`, which would otherwise coerce any non-empty string (including the literal text `"false"`) to `true`.
