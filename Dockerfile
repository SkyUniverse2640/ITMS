# ---- Build stage: Node + npm (correct musl native binaries; avoids Bun's
#      unimplemented node:v8.isBuildingSnapshot that breaks mongoose at build) ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (warm cache layer). npm resolves the correct
# alpine/musl native binaries for @next/swc and tailwind oxide.
# `npm install` (not `npm ci`) so the platform-specific optional native
# deps resolve for linux/musl regardless of where the lockfile was generated.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Build the app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

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
