# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ArchScore Frontend — SvelteKit client for a live archery league scoring system. This repository currently only contains the **auth/profile shell** (login, register, profile, permission-gated nav) — the scoreboard feature described in `README.md`'s "Projektstruktur" does not exist yet in `src/`; treat that section of the README as aspirational, not current state.

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

**Auth state** (`src/lib/stores/auth.svelte.ts`): `AuthStore` is a plain class using Svelte 5 `$state` runes (not a traditional Svelte store), exported as the singleton `auth`. Access/refresh tokens are persisted to `localStorage`. `auth.init()` (called once from the root layout's `onMount`) validates the stored access token via `/auth/me`, and transparently refreshes it on a 401. `appConfig` (`src/lib/stores/config.svelte.ts`) is the same pattern, fetching `/api/config` for the `allow_registration` flag — also not read from `PUBLIC_ALLOW_REGISTRATION` in `.env`.

**Fake-API (MSW)** (`src/mocks/`): The backend is developed independently in a separate repo, so this frontend runs dev against a mocked API by default — no live backend needed. Mock Service Worker (`msw`) intercepts `fetch` in the browser; started from `src/routes/+layout.ts`'s `load()` (`browser && dev` gated, before `setupI18n`), registered worker script at `static/mockServiceWorker.js` (generated via `npx msw init static --save`, re-run after an `msw` upgrade if it warns about a stale script). Structure mirrors `src/lib/api/`: one handler file per feature module (`src/mocks/handlers/auth.ts`, `config.ts`, ...), combined in `src/mocks/handlers/index.ts`. `src/mocks/fixtures.ts` defines named scenario users (`member`/`judge`/`admin` — password for all: `test1234`), typed as `User` from `src/lib/api/auth.ts` so mocks and real client can't drift on shape. `src/mocks/db.ts` holds in-memory token/session state for the mock run (login, refresh rotation, profile edits) — resets on page reload, no persistence. Toggle: `PUBLIC_USE_MOCKS=false` in `.env` to hit a real local backend instead. **New endpoint workflow**: build the mock handler first against the UI's needed shape (endpoint path/fields don't need to exist in `openapi.yaml` yet); once the backend dev adds it to the spec, reconcile the handler's path/fields against the spec and update the real `src/lib/api/*.ts` module + its TS types to match — the mock handler is the living diff between "what the frontend needs" and "what the contract currently promises".

**Spec-vs-implementation drift** (found while wiring the mocks, not yet reconciled): `src/lib/api/auth.ts` calls `/token/pair` + `/token/refresh` with `{access, refresh}`/`{refresh}` field names; `openapi.yaml` (as of submodule commit `2cdb9d9`) defines `/auth/login` + `/auth/refresh` instead, with camelCase `{accessToken, refreshToken, expiresIn}` / `{refreshToken}`. `authApi` also has no `logout()` call at all — `AuthStore.logout()` only clears local state, never invalidates the refresh token server-side, even though `/auth/logout` is already specified. Mock handlers currently mirror the **frontend's actual calls** (so the app keeps working), not the spec — needs a deliberate reconciliation pass with the backend dev once the spec stabilizes further.

**Permissions/roles**: resolved role-based, matching the spec's `User.role: archer | judge | admin` (not a Django-style permissions/groups model). `src/lib/api/auth.ts`'s `User` interface is `{id: string (uuid), username, email, role}`. `src/routes/+layout.svelte`'s `showAdminLink` and `src/lib/components/PermGuard.svelte` (prop `role?: Role | Role[]`, not used by any route yet) both gate on `auth.user?.role` directly — there is no `hasPermission`/`hasGroup`/`is_staff` anywhere in the codebase, don't reintroduce that pattern. (Previously this was a reproducible crash — `init repro` in commit history — where `+layout.svelte`/`PermGuard` called permission methods that didn't exist on `AuthStore`; fixed by adopting the role model instead of stubbing the Django-style API.)

**i18n** (`src/lib/i18n/`): `setupI18n()` registers `en`/`de` from `*.json` via `import.meta.glob`, runs in the root `+layout.ts` `load` (`setupI18n()` + `waitLocale()`), so translations are ready before first render. Locale choice persists to `localStorage`; use `$_('key')` in components and add new strings to both `en.json` and `de.json`.

**Routing**: file-based under `src/routes/` — `/` (page not yet built out), `/login`, `/register`, `/profile`. `/admin`, linked from the nav when `showAdminLink` is true, has no route yet.

**Auth UI pattern**: pages compose `AuthCard` (centered card shell) + `FormField` (labeled Bootstrap input, optional icon, `bind:value`) + Sveltestrap `Form`/`Alert`/`Button`/`Spinner`. Error messages are mapped to i18n keys by `APIError.status` rather than shown raw (see `login/+page.svelte`).
