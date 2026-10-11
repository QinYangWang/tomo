# Build the React client
FROM oven/bun:1-debian AS ui
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY ui ui
RUN bun run build

FROM oven/bun:1-debian
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
COPY --from=ui /app/ui/dist ui/dist
ENV TOMO_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["bun", "run", "src/main.ts"]
