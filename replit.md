# Livematchmv

Live football and futsal scores platform for the Maldives — real-time match updates, streaming links, tournament standings, player profiles, and an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/football-app run dev` — run the frontend (dynamic port via $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — for signed admin cookies
- Required env: `ADMIN_PASSWORD` — master admin password for first login

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, base path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind CSS v4 + `wouter` routing
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all contracts)
- `lib/db/src/schema/` — Drizzle schema files (11 tables)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/football-app/src/` — React frontend (pages, components, hooks)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not hand-edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas (do not hand-edit)

## Database Tables

teams, matches, streams, match_events, highlights, tournaments, lineups, squads, banners, admin_users, spotlights

## Architecture decisions

- Contract-first API: OpenAPI spec drives Zod validation (server) and React Query hooks (client)
- Admin auth uses signed cookies (`fl_admin`) via `cookie-parser` + `SESSION_SECRET`
- Dark navy/red brand theme via CSS custom properties in `index.css`
- All sports support both `football` and `futsal` via a `sport` field on teams/matches/tournaments

## Product

- Home page: scrollable date picker showing matches by day, sport filter tabs (All/Football/Futsal), live match banner
- Live page: real-time live matches with stream links
- Match detail: score, minute timer, events timeline, lineup tabs, highlights
- Stream page: HLS video player for live streams
- Tournament page: standings table, top scorers, fixture list
- Players page: searchable roster across all teams
- Admin dashboard: full CRUD for teams, tournaments, matches, events, lineup, streams, players, banners, spotlights, staff

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- `pnpm run typecheck:libs` must complete before leaf artifact typechecks
- The Vite config requires `PORT` and `BASE_PATH` env vars (provided by workflows)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
