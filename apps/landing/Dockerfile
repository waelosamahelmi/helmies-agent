# Helmies Studio — Landing App Dockerfile
# Preserved Next.js public website from helmies-studio

FROM node:22-alpine AS base
WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Source
COPY . .

# Build
RUN npm run build

# Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/next.config.js ./
COPY --from=base /app/public ./public

EXPOSE 3003

CMD ["npm", "start"]
