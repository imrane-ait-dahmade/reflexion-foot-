# Cognitif Connexion Foot — Frontend (Next.js standalone)
# Multi-stage, non-root, Node 22 LTS

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# Lockfile may lag optional platform deps; install resolves them for the image.
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public URL for client bundle (override in CI/compose).
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Server-side rewrite target inside Docker network (not baked into client).
ARG FASTAPI_PROXY_TARGET=http://backend:8000
ENV FASTAPI_PROXY_TARGET=$FASTAPI_PROXY_TARGET
# Placeholders so Next can collect page data (Better Auth imports Pool at module load).
# Runtime values come from Compose / EC2 .env — these are NOT production secrets.
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=require
ENV DATABASE_URL=$DATABASE_URL
ARG BETTER_AUTH_SECRET=build-time-placeholder-secret-min-32-chars
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL=http://localhost
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output (next.config output: "standalone")
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
