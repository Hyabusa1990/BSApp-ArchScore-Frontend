import { apiClient } from './client';

/**
 * Shapes 1:1 an das `scoring`-Referenzprojekt (`frontend/src/lib/api/binocular.ts`) angelehnt,
 * siehe FACHLICHKEIT.md "Migrations-Prinzip" — MIT einer bewussten Auslassung: kein
 * `ohne_digitale_meldung`-Feld/-Parameter. Dieser Fall wird zentral in der Admin-Oberfläche
 * (Ligaverwaltungs-Verbindung) abgefragt und vom Backend gespeichert, siehe Issue #4.
 *
 * Pfade folgen dem Fawkes-Spotter-Kontrakt (`ArchScore-SpecsAndDocu/Fawkes-OpenApi.json`,
 * `SpotterController`, Stand 2026-08-17, siehe #9): `token` im URL-Pfad ist die
 * `fixtureUniqueId`, `scheibennummer` ist `targetNo` — kein Bearer nötig, die schwer zu
 * erratende `fixtureUniqueId` selbst ist laut Spec die Absicherung.
 *
 * `shots`/`isConfirmed` sind die beiden echten Fawkes-Felder aus `GetTargetResponse`,
 * zusätzlich zu den Legacy-Feldern (status/extern_match_id/vorlaeufige_passen/...), die die
 * Spotter-Seite noch braucht — die Seite selbst wird erst in #7 auf den schlanken
 * Fawkes-Kontrakt umgebaut, bis dahin liefert der Mock beides parallel.
 */

export interface VorlaeufigePasse {
	position: number;
	lfd_nr: number;
	ringzahl_pfeil1: number | null;
	ringzahl_pfeil2: number | null;
}

export interface BinocularMatch {
	// Erlaubt der UI zu erkennen, dass auf derselben Scheibe ein neues Match aktiv wurde.
	extern_match_id: number;
	status: string;
	mannschaft_name: string;
	gegner_name: string;
	selected_members: number[];
	aktueller_satz: number;
	vorlaeufige_passen: VorlaeufigePasse[];
	schuetze_bestaetigte_saetze: number[];
	/**
	 * Fawkes-`shots`-String des aktuellen Satzes: 10 als "+", Fehlschuss (M) als "0", sonst
	 * Ziffer, konkateniert (z.B. 10,M,8 -> "+08"). Nicht geschossene Pfeile fehlen am
	 * Stringende, kein Platzhalter.
	 */
	shots: string;
	/** Ob der aktuelle Satz vom Spotter final bestätigt wurde (danach keine Änderung mehr). */
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
