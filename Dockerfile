# ArchScore Frontend — SvelteKit SPA (adapter-static), gebaut zu reinen statischen
# Dateien und über nginx ausgeliefert. Läuft eigenständig, kein Node-Server zur Laufzeit.
#
# Erwartete Deployment-Architektur (siehe CLAUDE.md): ein vorgeschalteter Reverse Proxy
# (z. B. Caddy) routet /api/* zum Backend-Container und alles andere hierher. API_URL ist
# im Code fest auf "/api" gesetzt — dieser Container muss /api selbst nicht kennen/proxien.

# ── Build-Stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# $env/static/public (svelte-i18n-Setup in +layout.ts) wird zur BUILD-Zeit eingebrannt,
# nicht zur Laufzeit gelesen — PUBLIC_USE_MOCKS muss deshalb hier vorhanden sein, sonst
# schlägt der Build hart fehl. In Produktion immer "false"; der Fake-API-Start ist ohnehin
# zusätzlich an den Dev-Modus gekoppelt (siehe +layout.ts) und liefe im Produktionsbuild
# so oder so nie an, das hier ist nur für einen sauberen, eindeutigen Build nötig.
ARG PUBLIC_USE_MOCKS=false
ENV PUBLIC_USE_MOCKS=${PUBLIC_USE_MOCKS}

RUN npm run build

# ── Runtime-Stage ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
