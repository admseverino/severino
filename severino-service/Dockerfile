# Production image for Cloud Run (built by cloudbuild.yaml).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/phone/package.json ./packages/phone/
COPY severino-service/package.json ./severino-service/
RUN pnpm install --frozen-lockfile --filter severino-service...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/phone/node_modules ./packages/phone/node_modules
COPY --from=deps /app/severino-service/node_modules ./severino-service/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db ./packages/db
COPY packages/phone ./packages/phone
COPY severino-service ./severino-service
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @severino/db run build
RUN pnpm --filter @severino/phone run build
RUN pnpm --filter severino-service run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=builder /app/severino-service/.next/standalone ./
COPY --from=builder /app/severino-service/.next/static ./severino-service/.next/static
COPY --from=builder /app/severino-service/public ./severino-service/public
EXPOSE 8080
CMD ["node", "severino-service/server.js"]
