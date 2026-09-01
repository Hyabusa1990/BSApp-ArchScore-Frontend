/**
 * Stub für `$env/static/public` — dieses Modul existiert nur innerhalb von Vite/SvelteKit
 * (virtuell, per Plugin generiert), nicht als echte Datei. `src/lib/config.ts` importiert
 * daraus (`PUBLIC_ALLOW_REGISTRATION`), und wird transitiv von jeder Mock-Handler-Datei über
 * `$lib/config` mitgeladen (`API_URL`) — ohne diesen Stub crasht `scripts/test-api-server.ts`
 * schon beim Import, obwohl `ALLOW_REGISTRATION` vom Test-Server nie tatsächlich genutzt wird.
 * Nur per `scripts/tsconfig.test-api.json`-Pfadmapping aktiv, NICHT Teil des echten App-Builds.
 */
export const PUBLIC_ALLOW_REGISTRATION = 'true';
