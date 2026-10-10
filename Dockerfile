FROM oven/bun:1-debian
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
ENV TOMO_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["bun", "run", "src/main.ts"]
