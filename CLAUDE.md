# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ArchScore Frontend — SvelteKit client for a live archery league scoring system. This repository currently only contains the **auth/profile shell** (login, register, profile, permission-gated nav) — the scoreboard feature described in `README.md`'s "Projektstruktur" does not exist yet in `src/`; treat that section of the README as aspirational, not current state.

Domain knowledge (competition structure, roles, scoring rules) lives in `FACHLICHKEIT.md` — read it before working on scoring/spotter/display features.

**Planned scope**: this app is meant to absorb the spotter-input ("binocular") and spectator-screen ("display") features currently live in a separate, older project (`/home/gero/PycharmProjects/scoring`, **read-only reference** — do not edit it), extended so it can run standalone without relying on the paper/digital Schusszettel that project depends on. That migration happens once this repo is stable; see `FACHLICHKEIT.md` for the reference project's relevant files and the open question of whether ArchScore becomes its own source of truth for results (the reference project deliberately isn't one — it's a proxy to an external league-management app).

The API contract lives in the `ArchScore-SpecsAndDocu` git submodule (`openapi.yaml` is the single source of truth, shared with the C# backend repo). If a submodule folder appears empty, run:

```bash
git submodule update --init --recursive
```

## Commands

```bash
npm run dev          # dev server with HMR (http://localhost:5173), proxies /api -> http://localhost:8000
npm run build         # production build (static adapter)
npm run preview       # preview the production build locally
npm run check          # svelte-kit sync + svelte-check (type checking)
npm run check:watch    # same, watch mode
npm run lint           # prettier --check . && eslint .
npm run format          # prettier --write .
```

No test runner is configured in `package.json` — there are no unit/e2e tests to run.

Setup: `cp .env.example .env` before first run. Backend development happens in a **separate repository** by another developer, independent of this frontend — this repo does not need a live backend to run in dev (see Fake-API below). `PUBLIC_USE_MOCKS=false` in `.env` switches to a real backend reachable at the proxied URL.

## Architecture

**Stack**: SvelteKit 2 + Svelte 5 (runes), TypeScript, `@sveltejs/adapter-static` (built as an SPA, `fallback: 'index.html'`), Sveltestrap (Bootstrap 5 components), `svelte-i18n`.

**API layer** (`src/lib/api/`): `client.ts` is a thin fetch wrapper — `apiClient.get/post/patch/delete`, injects `Authorization: Bearer <token>` when a token is passed, throws `APIError(status, data)` on non-2xx. Feature modules (`auth.ts`, `profile.ts`) each define their request/response interfaces and call through `apiClient`; add new endpoints by following this pattern rather than calling `fetch` directly. `API_URL` (`src/lib/config.ts`) is hardcoded to `/api` — note this does **not** currently read `PUBLIC_API_URL` from `.env`; the dev proxy in `vite.config.ts` rewrites `/api` to `http://localhost:8000`, and in production `/api` must be served/proxied at the same origin.

**Auth state** (`src/lib/stores/auth.svelte.ts`): `AuthStore` is a plain class using Svelte 5 `$state` runes (not a traditional Svelte store), exported as the singleton `auth`. Access/refresh tokens are persisted to `localStorage`. `auth.init()` (called once from the root layout's `onMount`) validates the stored access token via `/auth/me`, and transparently refreshes it on a 401. `ALLOW_REGISTRATION` (`src/lib/config.ts`) gates the register link/route — Fawkes has no `GET /config` endpoint for this, so it's read straight from the `PUBLIC_ALLOW_REGISTRATION` env var via `$env/static/public` (same pattern as `PUBLIC_USE_MOCKS` in `+layout.ts`), baked in at build time; no store, no loading state, no network request.

**Fake-API (MSW)** (`src/mocks/`): The backend is developed independently in a separate repo, so this frontend runs dev against a mocked API by default — no live backend needed. Mock Service Worker (`msw`) intercepts `fetch` in the browser; started from `src/routes/+layout.ts`'s `load()` (`browser && dev` gated, before `setupI18n`), registered worker script at `static/mockServiceWorker.js` (generated via `npx msw init static --save`, re-run after an `msw` upgrade if it warns about a stale script). Structure mirrors `src/lib/api/`: one handler file per feature module (`src/mocks/handlers/auth.ts`, `config.ts`, ...), combined in `src/mocks/handlers/index.ts`. `src/mocks/fixtures.ts` defines named scenario users (`member`/`admin` — password for all: `test1234`), typed as `User` from `src/lib/api/auth.ts` so mocks and real client can't drift on shape. `src/mocks/db.ts` holds in-memory token/session state for the mock run (login, refresh rotation, profile edits) — resets on page reload, no persistence. Toggle: `PUBLIC_USE_MOCKS=false` in `.env` to hit a real local backend instead. **New endpoint workflow**: build the mock handler first against the UI's needed shape (endpoint path/fields don't need to exist in `openapi.yaml` yet); once the backend dev adds it to the spec, reconcile the handler's path/fields against the spec and update the real `src/lib/api/*.ts` module + its TS types to match — the mock handler is the living diff between "what the frontend needs" and "what the contract currently promises".

**Auth contract**: `src/lib/api/auth.ts` calls the Fawkes endpoints confirmed against `ArchScore-SpecsAndDocu/Fawkes-OpenApi.json` (`AuthController`) — `POST /Auth/login` + `POST /Auth/register` + `POST /Auth/refresh` + `GET /Auth/me` + `POST /Auth/logout`, all camelCase (`{accessToken, refreshToken, expiresIn}`, `{refreshToken}`). Login/register go by **email**, not username. `AuthStore.logout()` calls `authApi.logout()` (best-effort — local state clears even if the server call fails) so the refresh token is invalidated server-side, not just cleared locally. `src/mocks/handlers/auth.ts` mirrors this same contract. Note `openapi.yaml` (the other spec in the same submodule, shared with the main C# backend repo) documents lowercase `/auth/...` paths for the same operations — Fawkes is the confirmed source for this frontend's calls; that casing mismatch between the two spec files is unreconciled upstream, not a frontend bug.

**Permissions/roles**: resolved role-based, exactly two account roles: `role: 'user' | 'admin'` (not a Django-style permissions/groups model, and — despite an earlier assumption in this file — **not** the `archer | judge | admin` enum that `ArchScore-SpecsAndDocu/openapi.yaml` currently documents; that spec enum turned out to be an early/inaccurate guess and was corrected here, not the other way round). `user` manages their own Veranstaltungen (ownership-scoped), `admin` manages all users and all Veranstaltungen. `src/lib/api/auth.ts`'s `User` interface is `{id: string (uuid), email, role?: Role}` — **no `username`** (Fawkes never had one) and `role` is now **optional/unused at the API boundary**: `GET /Auth/me` only ever returns `{id, email}`, so `auth.user.role` is always `undefined` for a real login. The field stays on the type only because `src/mocks/veranstaltungen.ts` still branches on `user.role === 'admin'` internally (mock DB state, not the `/Auth/me` response) for admin-wide vs. ownership-scoped mock data — real admin-vs-owner resolution is an open question, not yet answered by the backend. `src/routes/+layout.svelte`'s `showAdminLink` and `src/lib/components/PermGuard.svelte` (prop `role?: Role | Role[]`, not used by any route yet) both gate on `auth.user?.role` directly — there is no `hasPermission`/`hasGroup`/`is_staff` anywhere in the codebase, don't reintroduce that pattern. (Previously this was a reproducible crash — `init repro` in commit history — where `+layout.svelte`/`PermGuard` called permission methods that didn't exist on `AuthStore`; fixed by adopting the role model instead of stubbing the Django-style API.) This account-level role is a **separate axis** from the competition-domain roles in `FACHLICHKEIT.md` (Schütze/Spotter/Kampfrichter/Zuschauer) — those authenticate via passwordless per-resource tokens (Display JWT, Tablet QR-token), not via this `role` field at all.

**i18n** (`src/lib/i18n/`): `setupI18n()` registers `en`/`de` from `*.json` via `import.meta.glob`, runs in the root `+layout.ts` `load` (`setupI18n()` + `waitLocale()`), so translations are ready before first render. Locale choice persists to `localStorage`; use `$_('key')` in components and add new strings to both `en.json` and `de.json`.

**Routing**: file-based under `src/routes/` — `/` (page not yet built out), `/login`, `/register`, `/profile`. `/admin`, linked from the nav when `showAdminLink` is true, has no route yet.

**Auth UI pattern**: pages compose `AuthCard` (centered card shell) + `FormField` (labeled Bootstrap input, optional icon, `bind:value`) + Sveltestrap `Form`/`Alert`/`Button`/`Spinner`. Error messages are mapped to i18n keys by `APIError.status` rather than shown raw (see `login/+page.svelte`).
