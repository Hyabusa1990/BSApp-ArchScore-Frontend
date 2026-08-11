# ArchScore Frontend — SvelteKit SPA (adapter-static), gebaut zu reinen statischen
# Dateien und über static-web-server ausgeliefert. Läuft eigenständig, kein Node-Server
# zur Laufzeit.
#
# static-web-server (nicht nginx) bewusst gewählt: die Standard-Variante des Images ist
# scratch-basiert — keine Shell, kein Paketmanager, kaum Angriffsfläche für die üblichen
# OS-Paket-CVEs, die nginx:*-alpine-Images regelmäßig mitbringen (~76MB via nginx:alpine
# vs. ~15MB hier). Dediziert für genau diesen Zweck gebaut, inkl. SPA-Fallback.
#
# Erwartete Deployment-Architektur (siehe CLAUDE.md): ein vorgeschalteter Reverse Proxy
# (z. B. Caddy) routet /api/* zum Backend-Container und alles andere hierher. API_URL ist
# im Code fest auf "/api" gesetzt — dieser Container muss /api selbst nicht kennen/proxien.

# ── Build-Stage ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
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
# Pinned auf eine konkrete Version statt "latest"/"2" (bewegliche Tags) — bewusste,
# nachvollziehbare Entscheidung, wann eine neue Version übernommen wird.
FROM joseluisq/static-web-server:2.44.0 AS runtime

COPY --from=build /app/build /public

# Eigene Konfig statt reiner CLI-Flags: die eingebaute dateityp-basierte Cache-Control
# würde index.html sonst einen Tag lang cachen (empirisch geprüft, siehe docker/sws.toml).
COPY docker/sws.toml /etc/sws.toml

# Läuft nicht als root (anders als das vorherige nginx-Setup) und bindet einen
# unprivilegierten Port — root/Port 80 wäre hier gar nicht nötig, der vorgeschaltete
# Reverse Proxy verbindet sich ohnehin über das interne Docker-Netzwerk.
USER 65532:65532
EXPOSE 8080

ENTRYPOINT ["/static-web-server", "--config-file=/etc/sws.toml"]
