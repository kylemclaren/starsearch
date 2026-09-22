FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data MODEL_DIR=/app/models
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf /root/.bun/install/cache
COPY server ./server
COPY scripts/fetch-model.ts ./scripts/
RUN bun run scripts/fetch-model.ts
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["bun", "run", "server/index.ts"]
