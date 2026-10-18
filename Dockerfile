# Builds the server together with the web version of the app into one image.
# Used by docker-compose.yml. The config folder is mounted from outside, so it can be edited without rebuilding.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY web web
COPY config config
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
COPY config config
ENV PORT=4000 CONFIG_DIR=/app/config DATA_DIR=/app/data WEB_DIST_DIR=/app/web/dist
EXPOSE 4000
USER node
CMD ["node", "server/dist/index.js"]
