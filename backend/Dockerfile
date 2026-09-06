FROM node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e

WORKDIR /app
COPY package.json package-lock.sha256 ./
RUN test "$(npm --version)" = "11.19.0" \
 && npm install --package-lock-only --ignore-scripts --no-audit --no-fund \
 && sha256sum -c package-lock.sha256 \
 && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && rm -f package-lock.sha256
COPY src ./src
RUN chown -R node:node /app

USER node
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.mjs"]
