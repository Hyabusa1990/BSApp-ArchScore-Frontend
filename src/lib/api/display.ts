import { apiClient } from './client';

/**
 * Shapes angelehnt an das `scoring`-Referenzprojekt (`frontend/src/lib/api/display.ts`),
 * siehe FACHLICHKEIT.md "Migrations-Prinzip". Erweitert um `mode`/`paired`/`tabelle` sowie
 * `TabellenEintrag` (Shape aus dem `liga`-Referenzprojekt), da diese App zusätzlich zur
 * Trefferanzeige eine Tabellenansicht kennt.
 *
 * Auth weicht bewusst vom Referenzprojekt ab: JWT + 6-stelliger PIN statt reiner UUID
 * (`display_token`). Das JWT wird wie ein normaler Access-Token an `apiClient` übergeben.
 *
 * `DisplaySeite` folgt seit Issue #16 1:1 `TargetDisplayData` aus `GET /Display/data`
 * (`ArchScore-SpecsAndDocu/Fawkes-OpenApi.json`, `DisplayController`) — bewusst die echten
 * (englischen, camelCase) Feldnamen statt der sonst in dieser App üblichen deutschen
 * snake_case-Konvention, um keine Übersetzungsschicht mit eigenem Bug-Potenzial einzuziehen.
 * Kein serverseitiges Status-Feld mehr (das alte 5-Status-Modell WARTET/SCHUETZEN_GEMELDET/
 * SATZ_LAEUFT/SATZ_FERTIG/MATCH_FERTIG gab es nur im `scoring`-Referenzprojekt) — der Status
 * wird jetzt client-seitig aus den drei Rohfeldern hergeleitet, siehe `deriveMonitorStatus`.
 */

export interface DisplayCreateResponse {
	jwt: string;
	pin: string;
}

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

export interface TabellenEintrag {
	mannschaft_id: number;
	mannschaft_name: string;
	matchpunkte: number;
	matchpunkte_neg: number;
	satzpunkte_netto: number;
}

export interface DisplayContent {
	paired: boolean;
	mode: 'ergebnisse' | 'tabelle';
	scheibe_a: DisplaySeite | null;
	scheibe_b: DisplaySeite | null;
	/** Nur gesetzt, wenn mode === 'tabelle'. */
	tabelle?: TabellenEintrag[];
}

export const displayApi = {
	register: () => apiClient.post<DisplayCreateResponse>('/display/register', {}),

	getContent: (jwt: string) => apiClient.get<DisplayContent>('/display/content', jwt)
};
