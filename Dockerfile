# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

# The pinned toolchain versions are declared in package.json and .nvmrc.
WORKDIR /app

# openssl is required by Prisma's query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./

RUN npm ci

COPY . .

# The Prisma client is generated during the build so that the runtime image
# does not need the Prisma CLI.
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The uploads volume is mounted here. The directory must be writable by the
# unprivileged user that runs the application.
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
