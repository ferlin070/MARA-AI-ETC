# scripts/ — developer checks

## `smoke.mjs` — Playwright smoke check

Walks the officer's core path end-to-end against a real Vite dev server, with
every backend call stubbed via `page.route`. No API gateway and no Keycloak
needed.

```bash
node scripts/smoke.mjs            # headless
node scripts/smoke.mjs --headed   # watch it run
node scripts/smoke.mjs --base-url http://localhost:5173
```

Starts the dev server itself when nothing is listening on the base URL, and
stops it again on exit. If a server is already up it reuses it. Exit code 0 =
pass, non-zero = a named assertion failed.

Covered:

| # | Check |
|---|-------|
| 1 | Dev-mode session reaches the protected workspace (AuthGuard passes) |
| 2 | `/review` renders the officer queue from `/api/v1/officer/applications` |
| 3 | `/review/:id` shows the loading state **and no approve button while the detail request is in flight** |
| 4 | All five agent sections render (Compliance, Finance, Risk, Market, Recommendation) plus documents |
| 5 | Approve / Reject / Minta Maklumat appear only after the detail resolves (§10.4) |
| 6 | Unknown route renders the "Tidak Dijumpai" page with a link home |

The detail stub is deliberately delayed 1200 ms — that gap is what makes check 3
meaningful. Do not remove the delay.

---

## API error matrix

Implemented in `src/services/api.ts`, `request()`. Every failure is classified
once, at the transport boundary, into `ApiError.kind`; callers branch on `kind`
(or the `isForbidden` / `isServerFault` getters) instead of re-reading status
codes.

| Status | `ApiError.kind` | Behaviour | Who renders it |
|--------|-----------------|-----------|----------------|
| 401 | `unauthorized` | Clear local session, toast "Sesi tamat", redirect to `/login` via `logout()`. Only fires when a Bearer token was attached — a 401 from `/auth/login` is bad credentials, not a dead session. | Global (`handleUnauthorized`) |
| 403 | `forbidden` | No redirect — the session is still valid, the role is not. Inline permission banner. | Caller: `ReviewConsolePage`, `CaseDetailPage` show "diperlukan peranan Officer/Admin" |
| 5xx (first attempt) | — | One automatic retry after 400 ms, silent | `request()` |
| 5xx (retry also failed) | `server` | Toast "Pelayan mengalami masalah", throw with body message | Global toast + caller |
| 503 | `unavailable` | No retry. Explicit "Enjin OCR/klasifikasi dokumen tidak tersedia." | Caller (`ReviewConsolePage` has a dedicated branch) |
| network reject | `network` | "Rangkaian tidak dapat dihubungi" — never a raw `TypeError` | Caller |
| other 4xx | `http` | Body `message` / `detail`, else `Request failed (n)` | Caller |

Notes:

- Toasts need a mounted `<Toaster>`. `main.tsx` wraps the app in
  `@openhands/ui`'s `ToastManager`; without it sonner drops every toast silently.
- 401 handling is intentionally in the transport layer, not per-page: token
  expiry can hit any request and every page would otherwise need the same
  branch.
- Retry is a single fixed 400 ms delay, not exponential backoff. The endpoints
  here are an internal gateway, not a rate-limited third party; one retry
  absorbs a pod restart, more just delays the error the officer needs to see.
