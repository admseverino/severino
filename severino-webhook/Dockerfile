# Production image for Cloud Run (built by cloudbuild.yaml).
# Not used for local development — run `pnpm --filter severino-webhook run dev:ingest` instead.
# Multi-stage build for severino-webhook (monorepo workspace)
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/phone/package.json ./packages/phone/
COPY severino-service/package.json ./severino-service/
COPY severino-webhook/package.json ./severino-webhook/
RUN pnpm install --frozen-lockfile --filter severino-webhook...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/phone/node_modules ./packages/phone/node_modules
COPY --from=deps /app/severino-webhook/node_modules ./severino-webhook/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db ./packages/db
COPY packages/phone ./packages/phone
COPY severino-webhook ./severino-webhook
RUN pnpm --filter @severino/db run build
RUN pnpm --filter @severino/phone run build
RUN pnpm --filter severino-webhook run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/phone/package.json ./packages/phone/package.json
COPY --from=builder /app/packages/phone/dist ./packages/phone/dist
COPY --from=builder /app/severino-webhook/package.json ./severino-webhook/package.json
COPY --from=builder /app/severino-webhook/dist ./severino-webhook/dist
COPY severino-webhook/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /app/severino-webhook
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
