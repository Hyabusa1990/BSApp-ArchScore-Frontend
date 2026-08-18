/**
 * Eigenständiger LAN-Test-API-Server — bewusst AUSSERHALB von src/routes (kann den
 * adapter-static-Build damit nicht beeinflussen, siehe Dockerfile/CLAUDE.md "Production-Build").
 * Nutzt dieselben Mock-Handler wie die Browser-Fake-API (`src/mocks/handlers`), aber über
 * echtes HTTP statt Service-Worker-Interception — dadurch KEINE HTTPS-/Zertifikats-Anforderung
 * fürs LAN. Ein Service Worker braucht zwingend einen sicheren Kontext (HTTPS oder localhost);
 * ein normaler `fetch()` zu einem echten Server dagegen nicht, plain HTTP reicht im LAN völlig.
 *
 * Funktionsweise: `msw/node`s `setupServer()` patcht `fetch()` in DIESEM Prozess, genau wie
 * `msw/browser` es im Browser tut. Für jeden echten eingehenden HTTP-Request bauen wir hier
 * einen lokalen `fetch()`-Call nach — MSW fängt den ab und beantwortet ihn über dieselben
 * Handler, die auch die Browser-Mocks treiben (kein duplizierter Code, kein Drift-Risiko).
 *
 * Zielszenario (Wunsch Gero, 2026-08-18): reale Hardware (TV-Stick, Raspberry Pi, Tablet) im
 * LAN gegen Display/Spotter testen, ohne echtes Backend und ohne Zertifikats-Hampelei.
 *
 * Setup:
 *   1. `npm run test-api`             — startet diesen Server auf Port 8000
 *   2. `.env`: `PUBLIC_USE_MOCKS=false` — Browser-MSW/Service-Worker abschalten, die App macht
 *      dann echte fetch()-Calls gegen /api statt Requests im Browser abzufangen
 *   3. `npm run dev -- --host`        — Vite-Dev-Server im LAN erreichbar; `/api` wird laut
 *      vite.config.ts bereits nach http://localhost:8000 geproxied (= dieser Server), das
 *      passiert server-seitig auf demselben Rechner, kein LAN-Hop nötig
 *   4. Vom Testgerät aus: http://<lan-ip>:5173/display bzw. /binocular/... aufrufen — normales
 *      HTTP reicht, kein Zertifikat zu akzeptieren
 *
 * Läuft NICHT im normalen Dev-Alltag mit, nur bei Bedarf separat gestartet.
 */

// Muss VOR dem Import von `msw/node` passieren: alle Handler-Pfade sind relativ (`/api/...`,
// siehe API_URL in $lib/config.ts) — msw@2.15s `setupServer()` löst relative Pfade intern über
// `getAbsoluteUrl()` auf, die bei fehlendem `location`-Global (in Node schlicht nicht
// vorhanden) den Pfad UNVERÄNDERT relativ lässt, statt ihn gegen einen Origin aufzulösen.
// Ergebnis ohne diesen Shim: kein Handler matcht je einen echten (zwangsläufig absoluten)
// fetch()-Request, jeder Call landet als "unhandled" (siehe node_modules/msw/lib/core/utils/
// url/getAbsoluteUrl.mjs). `location.href` reicht als minimaler Ersatz.
globalThis.location = { href: 'http://localhost/' } as Location;

// Muss VOR dem Import der Mock-Handler passieren: persist.ts (src/mocks/) prüft
// `typeof localStorage === 'undefined'` und würde sonst bei JEDEM Request wieder frisch
// seeden, statt Zustand über mehrere Requests hinweg zu behalten (Admin-Änderungen,
// Geräte-Zuordnungen, Login-Sessions wären sonst sofort wieder weg).
const store = new Map<string, string>();
// @ts-expect-error — Node kennt kein DOM-`Storage`-Interface, minimaler Ersatz reicht hier.
globalThis.localStorage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value),
	removeItem: (key: string) => void store.delete(key),
	clear: () => store.clear(),
	key: (index: number) => Array.from(store.keys())[index] ?? null,
	get length() {
		return store.size;
	}
};

import { createServer, type IncomingMessage } from 'node:http';
import { setupServer } from 'msw/node';
import { handlers } from '../src/mocks/handlers';

const PORT = 8000;

// Von fetch()/undici verwaltete bzw. verbotene Header — beim Nachbauen des Requests raus,
// sonst rekonstruiert fetch() z.B. Content-Length falsch/doppelt.
const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);

function toRequestHeaders(raw: IncomingMessage['headers']): HeadersInit {
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined || SKIP_HEADERS.has(key.toLowerCase())) continue;
		headers[key] = Array.isArray(value) ? value.join(', ') : value;
	}
	return headers;
}

const mswServer = setupServer(...handlers);
// 'error' würde bei jedem nicht gemockten Pfad hart crashen — 'warn' reicht für ein
// Test-Tool, ein einzelner unbekannter Request soll nicht den ganzen Server mitreißen.
mswServer.listen({ onUnhandledRequest: 'warn' });

const httpServer = createServer(async (req, res) => {
	try {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const bodyAllowed = req.method !== 'GET' && req.method !== 'HEAD';

		const request = new Request(`http://localhost${req.url}`, {
			method: req.method,
			headers: toRequestHeaders(req.headers),
			body: bodyAllowed && chunks.length > 0 ? Buffer.concat(chunks) : undefined
		});

		// Läuft im selben Prozess wie mswServer.listen() -> dieser fetch()-Call wird von MSW
		// abgefangen und über die passenden Handler aufgelöst, exakt wie im Browser.
		const response = await fetch(request);

		res.statusCode = response.status;
		response.headers.forEach((value, key) => res.setHeader(key, value));
		const responseBody = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
		res.end(responseBody);
	} catch (err) {
		console.error('[test-api] Request fehlgeschlagen:', err);
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ detail: 'Test-API-Server-Fehler' }));
	}
});

httpServer.listen(PORT, () => {
	console.log(
		`[test-api] läuft auf http://localhost:${PORT} — nur für den Vite-Dev-Proxy gedacht.`
	);
	console.log('[test-api] Login-Fixture-User: siehe src/mocks/fixtures.ts (Passwort: test1234)');
});
