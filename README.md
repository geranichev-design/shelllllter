# Shelter Registry Foundation

Monorepo foundation for a shelter management system.

## Figma Code

This repository includes a browser-only demo for Figma Code layers. It opens the
dashboard as a demo DSNS user, without credentials, Docker, PostgreSQL, or a backend.
The demo has no login screen: `/login` redirects straight to `/dashboard`.
Switch roles in the demo bar; signing in or out is not required.

1. In Figma Design, choose **Code → Clone repository**.
2. Clone `https://github.com/geranichev-design/shelllllter.git`, branch `main`.
3. The `.figma/make/install` and `.figma/make/dev` scripts install the frontend and
   shared UI workspace, then launch the demo on Figma's `$PORT` at `0.0.0.0`.
   `.mise.toml` specifies Node.js 22 and pnpm 10.5.0.

Figma may add environment-specific publishing and cached-preview scripts during
its first setup. The repository's build command is `pnpm build:figma`; the built
Next.js app starts with `pnpm start:figma` and honors `$PORT`.

The demo contains 5 shelters, 16 requests, 7 organizations, and four selectable
roles. Use the **Демоверсія** bar to switch roles or **Відновити приклад** to reset
the demo records. Creating requests, reviewing them, and editing shelters works
locally. Changes persist in this browser's local storage; if sandboxed storage
is blocked, they last for the current page session. This is a prototype using
synthetic data, not shared multi-user storage or real authentication.

To try the same demo locally:

```bash
pnpm install --frozen-lockfile --filter frontend...
PORT=3010 pnpm dev:figma
```

Open `http://127.0.0.1:3010`. The root commands `pnpm dev`, `pnpm build`, and
`pnpm start` also target this demo. Explicit commands below retain the full local
API workflow. Demo mode is enabled by default, including when Figma launches
`apps/frontend` directly. Real API mode requires `NEXT_PUBLIC_DEMO_MODE=false`;
`pnpm dev:frontend` and `pnpm build:frontend` set it explicitly. Changing the mode
requires restarting the dev server or rebuilding production assets.
The demo uses separate auth/data storage keys and `.next-figma*` build directories.

If a previously cloned Figma Code layer still shows an email/password form or an
API connection error, pull the latest `main` into that clone (or clone it again)
and restart/rebuild the preview. A GitHub push does not update an existing Figma
clone or a previously built preview automatically. For this prototype, remove a
previously configured `NEXT_PUBLIC_DEMO_MODE=false` or set it to `true` in Figma.

Validation: `pnpm test:demo`, `pnpm build:figma`, and `pnpm build:frontend`.

## Structure

- `apps/backend` - NestJS API with Prisma and JWT auth
- `apps/frontend` - Next.js App Router UI
- `packages/ui` - Shared UI primitives
- `prisma` - Root Prisma schema

## Full-stack local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create environment files:

   - copy `apps/backend/.env.example` to `apps/backend/.env`
   - copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local`
   - adjust `DATABASE_URL`, `JWT_SECRET`, and `NEXT_PUBLIC_API_BASE_URL`

3. Start the full stack (DB + migrations + seed + both apps):

   ```bash
   pnpm dev:mock
   ```

   The seed script loads demo users, organizations, shelters, and shelter requests into the local database, then starts backend and frontend dev servers.

## Terminal commands

| Command | Description |
|---|---|
| `pnpm dev:mock` | Start everything: DB, migrations, seed, backend + frontend |
| `pnpm dev:frontend` | Start only the Next.js frontend (port 3000) |
| `pnpm dev:backend` | Start only the NestJS backend (port 3001) |
| `pnpm db:up` | Start the PostgreSQL Docker container |
| `pnpm db:down` | Stop the PostgreSQL Docker container |
| `pnpm prisma:generate` | Regenerate Prisma client |
| `pnpm prisma:migrate` | Apply DB schema (resets data) |
| `pnpm prisma:seed` | Seed demo data |
| `pnpm build:frontend` | Build frontend for production |
| `pnpm build:backend` | Build backend for production |

After startup the app is available at **http://127.0.0.1:3000**.

## Notes

- The backend now includes the shelter request lifecycle and pending verification query.
- The frontend includes the request submission, review, detail, and pending verification screens.
- Business logic beyond Stage 1, maps, and analytics are intentionally not implemented yet.

## Seed users

- `balance-holder@example.com`
- `gov-org@example.com`
- `regional@example.com`
- `dsns@example.com`

The seed script generates a random demo password and prints it in the local terminal.
To choose your own demo password, set `DEMO_SEED_PASSWORD` in `apps/backend/.env`
before seeding. Local environment files are excluded from Git.
