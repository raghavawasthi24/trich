# Hotel Rate Comparator — Client

Standalone React + Vite SPA. Independent npm project — no workspace link to `server/`; it talks to the API purely over HTTP/CORS.

## Quickstart

```bash
cp .env.example .env
npm install
npm run dev   # http://localhost:5173
```

Requires `server/` running at `VITE_API_BASE_URL` (default `http://localhost:4000`).

## Dev scenario picker

When `VITE_ENABLE_SCENARIOS=true` (the default), a dropdown above the search form lets you force any supplier scenario (A cheaper, both fail, one empty, a slow supplier, etc.) via the `x-mock-scenario` header — the same mechanism the server's `demo:scenarios` script and integration tests use. Useful for reviewing every required case without touching devtools.

## Testing

```bash
npm test          # Vitest + MSW component tests — no server needed at all
npm run test:e2e   # Playwright — needs the full stack running (see server/README.md)
```

The Vitest suite (`tests/unit/`) mocks the API with MSW, so `npm test` here never makes a real network call. `tests/e2e/` drives the live UI in a browser and includes a contract spec (`contract.spec.ts`) that asserts the live server response still matches `src/types/api.ts`.

## Keeping the contract in sync

There is no shared package between `client/` and `server/` by design (see root README). `src/types/api.ts` is a hand-written mirror of `server/src/schemas/search.schema.ts` — if the server contract changes, update this file and re-run `npm run test:e2e` to catch drift via the contract spec.

## Known limitations

- `VITE_API_TOKEN` ships inside the browser bundle — there is no server-side place to hide it in a pure SPA. See root README.
- Node 20+ is required (matches the server). Playwright in particular refuses to run under Node 18.
