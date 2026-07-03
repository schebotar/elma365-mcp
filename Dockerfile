# ── Build stage ───────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/dist/ ./dist/

RUN npm ci --omit=dev

EXPOSE 3000

CMD ["node", "dist/index.js", "--http", "--port", "3000"]
