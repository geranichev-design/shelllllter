# Shelter Registry Foundation

Monorepo foundation for a shelter management system.

## Structure

- `apps/backend` - NestJS API with Prisma and JWT auth
- `apps/frontend` - Next.js App Router UI
- `packages/ui` - Shared UI primitives
- `prisma` - Root Prisma schema

## Local setup

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
