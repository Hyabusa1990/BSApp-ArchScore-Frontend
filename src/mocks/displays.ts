import type { DeviceTokenResponse, DisplayDataResponse, DisplaySeite } from '$lib/api/display';
import {
	begegnungenForMatch,
	findAktivesMatchFuerScheibe,
	findAssignedDeviceByCode,
	getLigaTable,
	mannschaftUndGegner,
	registerDeviceCode
} from './veranstaltungen';
import { berechneMatchStand, peekScoringState, ringSumme } from './shared-state';
import { encodeShots } from './binoculars';
import { loadState, saveState } from './persist';

/**
 * Fake-Backend-Zustand für Displays (Issue #17) — folgt seit hier dem echten
 * `GET /Display/register`/`GET /Display/data`-Kontrakt: ein Gerät registriert sich selbst und
 * bekommt einen `deviceCode` (denselben Pool, den der Admin-Zuordnen-Flow prüft, siehe
 * `veranstaltungen.ts`), danach ist es ein normaler Bearer-Client (`accessToken`). Zuordnung zu
 * einer Fixture passiert ausschließlich admin-seitig (`assignDevice`) — dieses Modul liest den
 * Zuordnungs-Zustand nur, es schreibt ihn nie.
 *
 * Token-Maps über `localStorage` persistiert (siehe `persist.ts`), NICHT nur In-Memory (Issue
 * #20, Fehlerbericht Gero 2026-08-18): MSW-Handler laufen im JS-Kontext der Seite, nicht im
 * eigentlichen Service-Worker-Skript — ein reines Reload (F5) legt diesen Kontext komplett neu
 * an, In-Memory-Maps wären dann leer. Ohne Persistenz hätte das Gerät seinen eigenen, im
 * `+page.svelte` in `localStorage` gemerkten `accessToken` serverseitig verloren, der
 * Refresh-Versuch wäre ebenfalls ins Leere gelaufen (auch das `refreshToken` unbekannt) —
 * Ergebnis: kompletter Re-Register bei jedem F5, neuer `deviceCode`, Admin-Zuordnung futsch.
 *
 * Refresh-Rotation (Issue #19, Wunsch Gero 2026-08-18): der `deviceCode` soll erhalten bleiben,
 * solange sich das Gerät irgendwie authentifizieren kann — ein abgelaufener `accessToken` allein
 * darf keine Neu-Registrierung (= neuer `deviceCode`, der Admin müsste erneut zuordnen)
 * auslösen, nur ein abgelaufenes/ungültiges `refreshToken`. `rotateDeviceTokens` wird über den
 * geteilten `POST /Auth/refresh`-Endpunkt aufgerufen (siehe `handlers/auth.ts`).
 */

interface SessionState {
	accessTokens: Record<string, string>; // accessToken -> deviceCode
	refreshTokens: Record<string, string>; // refreshToken -> deviceCode
}

const STORAGE_KEY = 'displaySessions';

function loadSessions(): SessionState {
	return loadState(STORAGE_KEY, () => ({ accessTokens: {}, refreshTokens: {} }));
}

function persistSessions(state: SessionState): void {
	saveState(STORAGE_KEY, state);
}

function issueDeviceTokens(deviceCode: string): DeviceTokenResponse {
	const state = loadSessions();
	const accessToken = `mock-display.${crypto.randomUUID()}`;
	const refreshToken = `mock-display-refresh.${crypto.randomUUID()}`;
	state.accessTokens[accessToken] = deviceCode;
	state.refreshTokens[refreshToken] = deviceCode;
	persistSessions(state);
	return { deviceCode, accessToken, refreshToken, expiresIn: 3600 };
}

/** Entspricht `GET /Display/register`. */
export function registerDevice(): DeviceTokenResponse {
	return issueDeviceTokens(registerDeviceCode());
}

/** Refresh-Rotation für Geräte-Token — analog `db.ts`s `rotateTokens`, aber gegen den
 * `deviceCode` statt eine User-ID. `undefined` = `refreshToken` unbekannt/schon verbraucht,
 * der Aufrufer (`handlers/auth.ts`) probiert dann noch die User-Account-Rotation. */
export function rotateDeviceTokens(refreshToken: string): DeviceTokenResponse | undefined {
	const state = loadSessions();
	const deviceCode = state.refreshTokens[refreshToken];
	if (!deviceCode) return undefined;
	delete state.refreshTokens[refreshToken];
	persistSessions(state);
	return issueDeviceTokens(deviceCode);
}

function leereSeite(targetNo: number | null): DisplaySeite {
	return {
		targetNo,
		teamName: null,
		shots: null,
		setScores: null,
		currentSetScore: null,
		setPoints: null
	};
}

function buildSeiteForScheibe(scheibennummer: number | null): DisplaySeite {
	if (scheibennummer === null) return leereSeite(null);

	const found = findAktivesMatchFuerScheibe(scheibennummer);
	if (!found) return leereSeite(scheibennummer);

	const { mannschaft } = mannschaftUndGegner(found.begegnung, found.seite);
	const scoringOwn = peekScoringState(scheibennummer);

	// Match aktiv, aber der Spotter hat diese Scheibe noch nie geöffnet — Scoring-Zustand
	// existiert dann noch gar nicht (peekScoringState legt ihn bewusst nicht an, siehe
	// shared-state.ts). shots/setScores bleiben leer -> deriveMonitorStatus liefert
	// VOR_DEM_MATCH. shooters ist reiner Mock-Platzhalter (das Admin-Modell kennt keine echte
	// Schützen-Aufstellung, siehe binoculars.ts) — nur damit der Chip-Zweig testbar ist.
	if (!scoringOwn) {
		return {
			targetNo: scheibennummer,
			teamName: mannschaft,
			shots: null,
			setScores: null,
			currentSetScore: null,
			setPoints: null,
			shooters: ['Schütze 1', 'Schütze 2', 'Schütze 3']
		};
	}

	const gegnerScheibe = found.seite === 'a' ? found.begegnung.scheibe_b : found.begegnung.scheibe_a;
	const stand = berechneMatchStand(
		found.seite === 'a' ? scheibennummer : gegnerScheibe,
		found.seite === 'a' ? gegnerScheibe : scheibennummer
	);
	const eigeneSatzpunkte = found.seite === 'a' ? stand.satzpunkteA : stand.satzpunkteB;

	const lfdNr = scoringOwn.aktueller_satz;
	const passenAktuellerSatz = scoringOwn.vorlaeufige_passen.filter((p) => p.lfd_nr === lfdNr);
	const shotsAktuellerSatz = encodeShots(passenAktuellerSatz);

	// Eigene Ringsummen aller vom eigenen Spotter schon bestätigten Sätze — unabhängig davon,
	// ob die Gegenseite auch schon fertig ist (Fortschritt bleibt pro Spotter unabhängig,
	// siehe FACHLICHKEIT.md). Kein eigener "Match fertig"-Zustand mehr (#16): die letzten
	// setScores bleiben nach Matchende einfach stehen.
	const setScores = Array.from({ length: lfdNr - 1 }, (_, i) =>
		ringSumme(scoringOwn.vorlaeufige_passen, i + 1)
	);

	return {
		targetNo: scheibennummer,
		teamName: mannschaft,
		shots: shotsAktuellerSatz || null,
		setScores: setScores.length > 0 ? setScores : null,
		currentSetScore: shotsAktuellerSatz ? ringSumme(scoringOwn.vorlaeufige_passen, lfdNr) : null,
		setPoints: eigeneSatzpunkte
	};
}

/**
 * Entspricht `GET /Display/data`. `undefined` = `accessToken` unbekannt/abgelaufen (401, siehe
 * Handler). Solange der Admin den `deviceCode` noch keiner Fixture zugeordnet hat, bleibt
 * `displayType` auf `Unassigned` — genau der Zustand, den die Konsum-Seite als Pairing-Screen
 * zeigt (siehe `+page.svelte`).
 *
 * Zeigt bewusst nur die ERSTE Begegnung des zugeordneten Matches (`begegnungenForMatch`) — ein
 * Match kann mehrere gleichzeitige Begegnungen (mehrere Scheiben-Paare) haben, ein einzelnes
 * Gerät kennt aber nur `matchNo`, keine konkrete Scheibenpaar-Auswahl. Mehrere Begegnungen auf
 * einem Gerät sauber darzustellen ist ein offenes Design-Thema, keine Backend-Kontraktfrage —
 * hier bewusst nicht vorweggenommen.
 *
 * `LigaTable` (Issue #18) liest unabhängig vom `matches`/`currentRoundNo`-Zustand direkt aus
 * `ligaTables` — die Ligatabelle läuft über den ganzen Wettkampftag, nicht pro Runde.
 */
export function getDisplayData(accessToken: string): DisplayDataResponse | undefined {
	const deviceCode = loadSessions().accessTokens[accessToken];
	if (!deviceCode) return undefined;

	const assigned = findAssignedDeviceByCode(deviceCode);
	if (!assigned) return { displayType: 'Unassigned', targets: [], ligaTable: [] };

	const { veranstaltungId, device } = assigned;

	if (device.displayType === 'LigaTable') {
		return { displayType: 'LigaTable', targets: [], ligaTable: getLigaTable(veranstaltungId) };
	}

	if (device.displayType !== 'Match' || device.matchNo === null) {
		return { displayType: 'None', targets: [], ligaTable: [] };
	}

	const [begegnung] = begegnungenForMatch(veranstaltungId, device.matchNo);
	if (!begegnung) return { displayType: 'None', targets: [], ligaTable: [] };

	return {
		displayType: 'Match',
		targets: [buildSeiteForScheibe(begegnung.scheibe_a), buildSeiteForScheibe(begegnung.scheibe_b)],
		ligaTable: []
	};
}
