# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (warm cache layer). npm resolves the correct
# alpine/musl native binaries for @next/swc and tailwind oxide.
# `npm install` (not `npm ci`) so the platform-specific optional native
# deps resolve for linux/musl regardless of where the lockfile was generated.
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema present.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install --no-audit --no-fund

# Build the app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next evaluates server modules during "collect page data", and both
# src/lib/auth.ts and src/lib/db.ts refuse to load without their env var —
# deliberate fail-fast behaviour at server start. Nothing signs a token or
# opens a connection during the build, so placeholders satisfy the checks.
# They stay in this stage; the runtime image takes the real values from the
# environment.
ENV JWT_SECRET=build-time-placeholder-not-used-at-runtime
ENV DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder
RUN npm run build

# This stage keeps the full node_modules, so it doubles as the migration and
# seed runner — see the `migrate` service in docker-compose.yml. The Prisma CLI
# pulls in more transitive packages than the standalone bundle carries, so it
# runs from here rather than from the slim runtime image below.

# ---- Runtime stage: minimal Node on Alpine ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user (busybox addgroup/adduser exist on Alpine)
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output bundles only the node_modules the server needs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
