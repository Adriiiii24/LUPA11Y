# syntax=docker/dockerfile:1.7
#
# La web de LupA11y (landing + API de auditoría) con su Chromium, para un despliegue en contenedor
# (Fly.io, Cloud Run, Railway, un VPS…). Es el modelo que encaja con la API: un proceso de larga vida
# con el navegador compartido, la cuota en memoria y el streaming de la auditoría.
#
#   docker build -t lupa11y-web .
#   docker run -p 3000:3000 -e LUPA11Y_SITE_URL=https://tu-dominio \
#     -e LUPA11Y_CLIENT_IP_HEADER=fly-client-ip -v lupa11y-data:/data lupa11y-web
#
# Seguridad: la API audita solo hosts públicos y el navegador sale por el proxy que valida cada
# conexión; aun así, conviene que la red del contenedor no alcance servicios internos.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    LUPA11Y_NETWORK=public-only \
    LUPA11Y_REPORTS_DIR=/data/reports
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/apps/web apps/web
# Chromium y sus dependencias del sistema, con la versión exacta de Playwright del lockfile.
RUN npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/reports \
    && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/robots.txt').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["npm", "start", "-w", "@lupa11y/web", "--", "-H", "0.0.0.0"]
