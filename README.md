# Hotel Rate Comparator

Search hotels by city + dates, fan out to two unreliable supplier APIs via a Temporal workflow, and return the cheapest rate reliably.

Two fully independent projects — `client/` (React + Vite SPA) and `server/` (Express API + Temporal worker). No workspaces, no shared package, no symlinking. Either can be cloned, installed, and run on its own.

```
hotel-rate-comparator/
├─ server/   # Express API + mock suppliers + Temporal worker (start here — it's independently demoable)
├─ client/   # React SPA
└─ README.md # this file
```

## Quickstart

```bash
# Terminal 1 — backend
cd server
cp .env.example .env
npm install
npm run temporal:up      # Temporal + Postgres + Web UI on :8080 (needs Docker)
npm run dev               # api :4000 + worker, both watching

# Terminal 2 — frontend
cd client
cp .env.example .env
npm install
npm run dev                # http://localhost:5173

# Verify the backend alone, no frontend or Docker UI needed:
cd server && npm run demo:scenarios
```

Full details, scripts, and env vars are in `server/README.md` and `client/README.md`.

## Design at a glance

- **Orchestration**: a Temporal workflow (`hotelSearchWorkflow`) fans out to both suppliers in parallel, each guarded by its own 5s cancellation scope and a 3-attempt retry policy, then picks the cheapest offer deterministically (`price → supplier A-before-B → hotelId`).
- **Mock suppliers**: two endpoints on the same Express process, with a deterministic scenario engine (`x-mock-scenario` header, or a magic city keyword) so every required edge case — both fail, one empty, a slow supplier, a flaky one, malformed payloads — can be triggered on demand instead of waiting on random chance.
- **API contract**: the server's Zod schemas are authoritative; the client keeps a small hand-written TypeScript mirror (`client/src/types/api.ts`) plus a Playwright contract spec that catches drift against the live server.

## Known limitations and assumptions

- Two suppliers only; the fan-out is a fixed pair rather than a dynamic registry.
- Prices are per-stay totals, not per-night. Single currency per search — offers in a different currency are dropped, not converted.
- No persistence layer beyond Temporal's own event history — no search history table, no caching.
- Mock suppliers run inside the same Express process as the gateway; in production they would be separate services.
- Static bearer token auth, not JWT/OIDC. Because the client is a pure SPA with no server of its own, `VITE_API_TOKEN` ships inside the browser bundle — there is no client-side place to hide it. A production build would need a thin BFF or an httpOnly session cookie.
- Contract duplication between `client/src/types/api.ts` and `server/src/schemas/` can drift; the Playwright contract spec catches it, but only when that suite is actually run.
- Rate limiting is in-memory (`express-rate-limit` default store), so it doesn't hold across multiple API replicas.
- The 12s HTTP guard + polling fallback is simpler than SSE/WebSocket push; `GET /api/search-hotels/:searchId` opportunistically returns the final result once the workflow has stopped running.
- Workflow code coverage isn't reflected in the server's Istanbul report — it runs inside Temporal's sandboxed V8 isolate, not the Jest-instrumented process, even though `server/tests/workflow` exercises every required scenario.
- No CI pipeline is defined. If added, it would be two independent jobs (`server-ci`, `client-ci`) plus a third `e2e` job that boots both.

## Bugs found and fixed during a live smoke test

Beyond the automated test suites, the app was actually run in a browser against the live server (see git history / session log). That caught two real bugs no unit test surfaced:

1. **`z.coerce.boolean()` on `AUTH_DISABLED`/`MOCK_CHAOS_ENABLED`** — Zod's coercion runs `Boolean(value)`, so the literal string `"false"` (as written in `.env.example`) coerced to `true`. Fixed with explicit `"true"`/`"false"` text parsing in `server/src/config/env.ts`.
2. **A `mountedRef` bug in `useHotelSearch`** — the ref was reset to `false` only in the effect's cleanup and never back to `true`, so React 18 StrictMode's dev-mode mount→unmount→remount cycle silently permanently disabled every subsequent `setState` call. The component's own Vitest tests didn't catch it because they don't render under `<React.StrictMode>`. Fixed by resetting the ref at the start of the effect, not just its cleanup.

Also found and fixed: Temporal's `Connection.connect()` throws a plain, undifferentiated `Error` ("Failed to connect before the deadline") when it can't reach a Temporal server, which the error handler didn't recognize as `ORCHESTRATOR_UNAVAILABLE` — it fell through to a generic 500. Fixed the detection and added a 3s `connectTimeout` so that failure path resolves quickly instead of hanging ~10s.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
