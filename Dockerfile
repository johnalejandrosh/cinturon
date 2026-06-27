# syntax=docker/dockerfile:1

# Production image for the Next.js 16 asteroid simulator.
# Multi-stage build → a minimal runtime image that runs the standalone server.
#
#   docker build -t asteroides .
#   docker run --env-file .env -p 3000:3000 asteroides
#
# Runtime config (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, …) is supplied
# at `docker run` time and never baked into the image.

# ───────────────────────────── Base ─────────────────────────────
# Debian "slim" (glibc) avoids the musl native-binary pitfalls Alpine can hit
# with Next's SWC compiler and Tailwind's oxide engine. Node 22 LTS.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ───────────────────────── Dependencies ─────────────────────────
# Own layer so it is cached until package.json / package-lock.json change.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────── Builder ────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `output: "standalone"` (next.config.ts) emits a self-contained server under
# .next/standalone. No database connection is required at build time.
RUN npm run build

# ──────────────────────────── Runner ────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as the unprivileged `node` user that ships with the official image, and
# let it own /app so the server can write its on-disk cache (.next/cache).
RUN mkdir -p /app/.next && chown -R node:node /app

# The standalone server plus the assets it does not bundle: hashed static
# chunks (.next/static) and the public/ folder.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

CMD ["node", "server.js"]
