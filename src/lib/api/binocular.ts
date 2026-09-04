import { apiClient } from './client';

/**
 * Pfade folgen dem Fawkes-Spotter-Kontrakt (`docs/Fawkes-OpenApi.json`,
 * `SpotterController`, Stand 2026-08-17, siehe #9): `token` im URL-Pfad ist die
 * `fixtureUniqueId`, `scheibennummer` ist `targetNo` — kein Bearer nötig, die schwer zu
 * erratende `fixtureUniqueId` selbst ist laut Spec die Absicherung.
 *
 * `BinocularMatch` entspricht seit 2026-09-04 1:1 `GetTargetResponse` — vorher liefen hier
 * zusätzlich diverse Legacy-Felder aus dem alten `scoring`-Referenzprojekt mit
 * (`status`/`extern_match_id`/`mannschaft_name`/`gegner_name`/`selected_members`/
 * `aktueller_satz`/`vorlaeufige_passen`/`schuetze_bestaetigte_saetze`), obwohl die echte API sie
 * nie liefert (`additionalProperties: false` in der Spec). Geprüft: von all dem las die
 * Spotter-Seite (`routes/tablet/.../+page.svelte`) nur `mannschaft_name` (-> `teamName`),
 * `extern_match_id` (Neues-Match-Erkennung beim Polling, jetzt über `teamName`-Wechsel gelöst)
 * und `status` (ACTIVE/COMPLETED-Umschaltung, jetzt über `isConfirmed` abgedeckt — siehe
 * `mocks/binoculars.ts`) — der Rest war reiner, nie gelesener Wire-Ballast.
 */

export interface BinocularMatch {
	targetNo: number;
	teamName: string | null;
	/** Ringsumme des aktuell laufenden Satzes, `null` solange noch kein Pfeil erfasst ist. */
	currentSetScore: number | null;
	/**
	 * Fawkes-`shots`-String des aktuellen Satzes: 10 als "+", Fehlschuss (M) als "0", sonst
	 * Ziffer, konkateniert (z.B. 10,M,8 -> "+08"). Nicht geschossene Pfeile fehlen am
	 * Stringende, kein Platzhalter.
	 */
	shots: string | null;
	/** Ob der aktuelle Satz vom Spotter final bestätigt wurde (danach keine Änderung mehr) —
	 * bleibt auch `true`, wenn das Match auf dieser Scheibe komplett entschieden ist (kein
	 * weiterer Satz kommt mehr), siehe `mocks/binoculars.ts`. */
	isConfirmed: boolean;
}

/** Ringzahl (0 = Miss/"M", 10, sonst 1-9) -> Fawkes-Zeichen. */
export function encodeShot(ringzahl: number): string {
	if (ringzahl === 10) return '+';
	return String(ringzahl);
}

/** Fawkes-Zeichen -> Ringzahl (0 = Miss/"M"). */
export function decodeShot(char: string): number {
	if (char === '+') return 10;
	return Number(char);
}

// `token` (die `fixtureUniqueId`) kommt aus dem URL-Pfad und kann ein URL-dekodiertes `/`
// enthalten (z. B. `%2F` in einem präparierten Link) — ohne Encoding würde das zusätzliche
// Pfadsegmente in die Fawkes-Anfrage einschleusen (Issue #17). `scheibennummer` ist `number`
// und bleibt unencodiert, ein TS-`number` kann strukturell kein `/` transportieren.
function spotterPath(token: string, scheibennummer: number): string {
	return `/fixtures/${encodeURIComponent(token)}/targets/${scheibennummer}/spotter`;
}

async function currentShots(token: string, scheibennummer: number): Promise<string> {
	const info = await apiClient.get<Pick<BinocularMatch, 'shots'>>(
		`${spotterPath(token, scheibennummer)}/info`
	);
	return info.shots ?? '';
}

export const binocularApi = {
	getScheibe: (token: string, scheibennummer: number) =>
		apiClient.get<BinocularMatch>(`${spotterPath(token, scheibennummer)}/info`),

	// PUT überschreibt bei jedem Aufruf den kompletten shots-String des aktuellen Satzes
	// (kein Einzelpfeil-Endpunkt) — daher hier erst den aktuellen Stand per GET holen, das
	// neue Zeichen anhängen und den vollen String senden.
	postPfeil: async (token: string, scheibennummer: number, ringzahl: number) => {
		const shots = (await currentShots(token, scheibennummer)) + encodeShot(ringzahl);
		return apiClient.put<BinocularMatch>(`${spotterPath(token, scheibennummer)}/shots`, { shots });
	},

	// Kein serverseitiger Undo-Call mehr: letztes Zeichen vom aktuellen shots-String
	// entfernen, verkürzten String per PUT senden.
	postUndo: async (token: string, scheibennummer: number) => {
		const shots = (await currentShots(token, scheibennummer)).slice(0, -1);
		return apiClient.put<BinocularMatch>(`${spotterPath(token, scheibennummer)}/shots`, { shots });
	},

	postBestaetigeSatz: (token: string, scheibennummer: number) =>
		apiClient.put<BinocularMatch>(`${spotterPath(token, scheibennummer)}/shots/confirm`, undefined)
};
