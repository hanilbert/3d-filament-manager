# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies for build
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Provide DATABASE_URL for Prisma during image build
ARG DATABASE_URL="file:/app/data/spool_tracker.db"
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client and prepare SQLite DB for Next.js build-time data access
RUN npx prisma generate
RUN mkdir -p /app/data && npx prisma migrate deploy

# Build Next.js (standalone mode configured in next.config.ts)
RUN npm run build

# Prune dev dependencies to keep only production dependencies
RUN npm prune --omit=dev

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy complete production node_modules (includes prisma and all dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Create data directory for SQLite and logos
RUN mkdir -p /app/data/logos && \
    chown -R nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the server
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
