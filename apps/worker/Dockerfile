# Helmies Studio — Worker Dockerfile

FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

CMD ["node", "dist/index.js"]
