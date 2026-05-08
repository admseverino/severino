# Database Schema and Migrations

- Single source of truth: [`packages/db`](../packages/db) (`@hidrosync/db`).
- The Next.js app (`hidrosync-service`) imports the typed client and schema only from this package.

## Change workflow

1. Edit Drizzle schema under [`packages/db/src/schema/`](../packages/db/src/schema/) (split by bounded context).
2. Generate SQL:

   ```bash
   pnpm run db:generate
   ```

3. Commit the generated files under [`packages/db/migrations/`](../packages/db/migrations/) (including `meta/`).
4. Apply locally:

   ```bash
   pnpm run db:migrate
   ```

5. (Optional) Verify drift:

   ```bash
   pnpm run db:check
   ```

For **`pnpm run db:migrate`**, set `DATABASE_URL` (and optional `DATABASE_SSL`) in the **repo root** `.env` (see root [`.env.example`](../.env.example)). The migrate script (`migrate:db`) loads only that file for connection settings. For `db:generate`, export `DATABASE_URL` or use a root `.env` if your Drizzle setup reads it.
