import { apiClient } from './client';

/**
 * Shapes folgen seit Issue #17 1:1 dem echten Fawkes-`DisplayController`-Kontrakt
 * (`docs/Fawkes-OpenApi.json`) statt eines eigenen JWT+PIN-Fake-Schemas:
 * `GET /Display/register` liefert einen `deviceCode` (denselben, den der Admin über
 * `bildschirmeApi.assign` einer Fixture zuordnet, siehe `$lib/api/bildschirme.ts`) plus
 * `accessToken`/`refreshToken`/`expiresIn` — das Gerät ist ab Registrierung ein normaler
 * Bearer-Client. `GET /Display/data` liefert `displayType` (`Unassigned` bis der Admin
 * zuordnet, sonst `None`/`Match`) + `targets`.
 *
 * `Table` existiert zwar im Spec-Enum von `DisplayController.DisplayType`, aber
 * `DeviceManagementController.UpdateDeviceData` (Admin-seitige Zuordnung) kennt nur
 * `None`/`Match`/`LeagueTable` — kein Admin-Pfad setzt ein Gerät je auf `Table`. Bewusst nicht
 * abgebildet, bis das vom Backend geklärt ist. `LeagueTable` (Issue #18, Rücksprache
 * Backend-Entwickler 2026-08-18, Wording auf `LeagueTable`/`leagueTable` korrigiert 2026-08-18)
 * ersetzt das alte Mock-only `mode: 'tabelle'`-Konzept — die Ligatabelle kommt jetzt direkt
 * eingebettet in `GET /Display/data` statt separat aus `MatchPlayChart` abgeleitet zu werden,
 * deshalb auch andere Feldnamen (`setPointsWon`/`setPointsLost`/`matchPointsWon`/
 * `matchPointsLost`/`position` statt `setPoints`/`matchPoints`). Feldname zunächst `leagueTable`
 * geraten (vor Spec-Klärung gebaut) — Spec-Sync 2026-09-04 hat den echten Namen
 * `leagueTablePositions` gebracht (Schema `LeagueTablePosition`, Felder identisch), hier
 * entsprechend korrigiert. Die Spec markiert das Feld außerdem `nullable` — anders als zuvor
 * angenommen, Konsumenten müssen `?? []` behandeln.
 *
 * `displayTheme` (ebenfalls Spec-Sync 2026-09-04, required) macht das Anzeige-Theme ab jetzt
 * backend-seitig: der Admin legt es pro Gerät fest (`$lib/api/bildschirme.ts`), diese Antwort
 * liefert den aktuellen Wert. Ersetzt die bisherige rein URL-routenbasierte Theme-Wahl
 * (`routes/display/[[theme]]`) als Wahrheitsquelle — das Routen-Segment bleibt nur noch als
 * Rate-Wert für den allerersten Ladezustand.
 *
 * `TargetDisplayData` folgt weiterhin 1:1 dem Fawkes-Feldnamen-Schema (englisch, camelCase),
 * siehe bisherige Begründung unten bei `deriveMonitorStatus`.
 */

/** `Fawkes.Api.Controllers.DisplayController.DeviceTokenResponse`. */
export interface DeviceTokenResponse {
	deviceCode: string;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export type DisplayDataType = 'Unassigned' | 'None' | 'Match' | 'LeagueTable';

/** `Fawkes.Api.Controllers.DisplayController.DisplayTheme` — eigenes Schema ggü.
 * `bildschirme.ts`s `DisplayTheme`, gleiche zwei Werte, wie schon bei `DisplayType`/
 * `DisplayDataType` nie im selben File verwendet. */
export type DisplayTheme = 'Light' | 'Dark';

/** `Fawkes.Api.Controllers.DisplayController.TargetDisplayData`. */
export interface DisplaySeite {
	targetNo: number | null;
	teamName: string | null;
	/** Fawkes-shots-String des aktuell laufenden Satzes, gleiche Kodierung wie beim Spotter
	 * (`+`=10, `0`=Miss, sonst Ziffer, siehe `$lib/api/binocular.ts`) — leer/null = kein Satz
	 * gerade offen. */
	shots: string | null;
	/** Ringsummen aller vom eigenen Spotter bereits bestätigten Sätze, ein Eintrag pro Satz. */
	setScores: number[] | null;
	/** Live-Ringsumme des aktuell laufenden Satzes. */
	currentSetScore: number | null;
	setPoints: number | null;
	/**
	 * Noch nicht Teil der aktuellen Fawkes-Spec (kommt evtl. später) — defensiv/optional
	 * behandeln. Nur relevant für `VOR_DEM_MATCH`, siehe `deriveMonitorStatus`.
	 */
	shooters?: string[];
}

export type MonitorStatus = 'VOR_DEM_MATCH' | 'SATZ_LAEUFT' | 'ZWISCHEN_SAETZEN';

/**
 * Ersetzt das serverseitige `monitor_status`-Feld des alten Modells (Fawkes liefert keins) —
 * genau drei Status, rein aus den Rohfeldern hergeleitet (Klärung mit Gero, 2026-08-18):
 * - `shots` nicht leer -> ein Satz läuft gerade.
 * - sonst `setScores` gefüllt -> zwischen zwei Sätzen (oder Match fertig, dafür gibt es
 *   bewusst keinen eigenen Zustand mehr — die letzten `setScores` bleiben einfach stehen).
 * - sonst -> vor dem eigentlichen Matchstart.
 */
export function deriveMonitorStatus(seite: DisplaySeite | null): MonitorStatus {
	if (seite?.shots) return 'SATZ_LAEUFT';
	if (seite?.setScores && seite.setScores.length > 0) return 'ZWISCHEN_SAETZEN';
	return 'VOR_DEM_MATCH';
}

/** `Fawkes.Api.Controllers.DisplayController.LeagueTablePosition` (Issue #18, Feldname
 * korrigiert im Spec-Sync 2026-09-04 — hieß vorher `LeagueTableEintrag`). */
export interface LeagueTablePosition {
	position: number;
	teamName: string;
	setPointsWon: number;
	setPointsLost: number;
	matchPointsWon: number;
	matchPointsLost: number;
}

/**
 * `Fawkes.Api.Controllers.DisplayController.DisplayDataResponse`. `targets` ist laut
 * Rücksprache Backend-Entwickler (2026-08-18) IMMER ein Array, nie `null` — bei `displayType`
 * `'LeagueTable'` einfach leer. `leagueTablePositions` ist laut Spec dagegen `nullable`
 * (Spec-Sync 2026-09-04) — Konsumenten müssen `?? []` behandeln, nicht nur auf `.length` bauen.
 */
export interface DisplayDataResponse {
	displayType: DisplayDataType;
	displayTheme: DisplayTheme;
	targets: DisplaySeite[];
	/** Nur befüllt, wenn `displayType === 'LeagueTable'` — sonst leer/`null`. */
	leagueTablePositions: LeagueTablePosition[] | null;
}

/** `Fawkes.Api.Controllers.AuthController.TokenResponse` — generischer Refresh-Endpunkt, gilt
 * laut Spec für jedes über `AuthController` ausgestellte Token-Paar, nicht nur User-Accounts
 * (Issue #19). Kein eigenes `deviceCode`-Feld: der Code steckt weiterhin im JWT-Payload, ändert
 * sich durch einen Refresh nicht. */
export interface RefreshedDeviceToken {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export const displayApi = {
	register: () => apiClient.get<DeviceTokenResponse>('/Display/register'),

	getData: (accessToken: string) =>
		apiClient.get<DisplayDataResponse>('/Display/data', accessToken),

	refresh: (refreshToken: string) =>
		apiClient.post<RefreshedDeviceToken>('/Auth/refresh', { refreshToken })
};
