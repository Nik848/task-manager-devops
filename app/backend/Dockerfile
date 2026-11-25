# ── Stage 1: Install production dependencies ────────────────────────────────
FROM node:20.20.2-alpine3.23 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production runner ──────────────────────────────────────────────
FROM node:20.20.2-alpine3.23 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: apply latest Alpine patches, remove unnecessary npm/corepack build tools, and create non-root user
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
    addgroup -g 1001 -S nodejs && \
    adduser -S taskapp -u 1001 -G nodejs

# Copy production dependencies, package.json (exclude lockfile with devDeps), and source
COPY --from=deps --chown=taskapp:nodejs /app/node_modules ./node_modules
COPY --chown=taskapp:nodejs package.json ./
COPY --chown=taskapp:nodejs src ./src

USER taskapp

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/index.js"]
