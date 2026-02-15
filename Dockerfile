FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Create non-root runtime user
RUN useradd --create-home --uid 10001 mcpuser

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY README.md LICENSE CHANGELOG.md ./

USER mcpuser

ENTRYPOINT ["node", "dist/index.js"]
