import { apiClient } from './client';

/**
 * Shapes folgen seit Issue #17 1:1 dem echten Fawkes-`DisplayController`-Kontrakt
 * (`ArchScore-SpecsAndDocu/Fawkes-OpenApi.json`) statt eines eigenen JWT+PIN-Fake-Schemas:
 * `GET /Display/register` liefert einen `deviceCode` (denselben, den der Admin über
 * `bildschirmeApi.assign` einer Fixture zuordnet, siehe `$lib/api/bildschirme.ts`) plus
 * `accessToken`/`refreshToken`/`expiresIn` — das Gerät ist ab Registrierung ein normaler
 * Bearer-Client. `GET /Display/data` liefert `displayType` (`Unassigned` bis der Admin
 * zuordnet, sonst `None`/`Match`) + `targets`.
 *
 * `Table` existiert zwar im Spec-Enum von `DisplayController.DisplayType`, aber
 * `DeviceManagementController.UpdateDeviceData` (Admin-seitige Zuordnung) kennt nur
 * `None`/`Match`/`LigaTable` — kein Admin-Pfad setzt ein Gerät je auf `Table`. Bewusst nicht
 * abgebildet, bis das vom Backend geklärt ist. `LigaTable` (Issue #18, Rücksprache
 * Backend-Entwickler 2026-08-18) ersetzt das alte Mock-only `mode: 'tabelle'`-Konzept — die
 * Ligatabelle kommt jetzt direkt eingebettet in `GET /Display/data` (`ligaTable`-Feld) statt
 * separat aus `MatchPlayChart` abgeleitet zu werden, deshalb auch andere Feldnamen
 * (`setPlus`/`setMinus`/`matchPlus`/`matchMinus`/`position` statt `setPoints`/`matchPoints`).
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

export type DisplayDataType = 'Unassigned' | 'None' | 'Match' | 'LigaTable';

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

/** `Fawkes.Api.Controllers.DisplayController.LigaTableEntry` (Issue #18). */
export interface LigaTableEintrag {
	teamName: string;
	setPlus: number;
	setMinus: number;
	matchPlus: number;
	matchMinus: number;
	position: number;
}

/**
 * `Fawkes.Api.Controllers.DisplayController.DisplayDataResponse`. Beide Arrays sind laut
 * Rücksprache Backend-Entwickler (2026-08-18) IMMER Arrays, nie `null` — bei `displayType`
 * `'LigaTable'` ist `targets` leer, bei `'Match'`/`'None'`/`'Unassigned'` ist `ligaTable` leer.
 * Konsumierender Code darf sich also nie auf `null` verlassen, nur auf `.length`.
 */
export interface DisplayDataResponse {
	displayType: DisplayDataType;
	targets: DisplaySeite[];
	/** Nur befüllt, wenn `displayType === 'LigaTable'` — sonst leer. */
	ligaTable: LigaTableEintrag[];
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
