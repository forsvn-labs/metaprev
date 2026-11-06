FROM oven/bun:1.4.3-debian
WORKDIR /app/site
COPY site/package.json site/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY site/server.ts ./server.ts
COPY site/lib ./lib
COPY site/data ./data
COPY site/views ./views
COPY site/public ./public
COPY app/src /app/app/src
ENV HOST=0.0.0.0 PORT=4323 SITE_URL=https://metaprev.forsvn.com PUBLIC_INDEXING=off METAPREV_PRIVATE_EDGE=on
USER bun
EXPOSE 4323
CMD ["bun", "server.ts"]
