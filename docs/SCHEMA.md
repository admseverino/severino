# Database Schema and Migrations

- Single source of truth: [`packages/db`](packages/db) (`@option/db`).

- To change a table: edit the schema TS under `packages/db/src/schema/<option|dash|scraping>/`, then run:

  - `pnpm run db:generate:option` | `db:generate:dash` | `db:generate:scraping`

- Commit the generated SQL under `packages/db/migrations/<db>/`.

- Apply locally: `pnpm run db:migrate` (optional DB filter: `pnpm run db:migrate -- option`).

- Verify drift: `pnpm run db:check`.

