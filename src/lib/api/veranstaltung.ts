import { apiClient } from './client';
import { matchkontrolleApi } from './matchkontrolle';

/**
 * Verwaltungsoberfläche — einziger Bereich mit echtem Benutzerkonto-Login (siehe
 * FACHLICHKEIT.md). Auth läuft über den bestehenden Account-`access_token` aus
 * `auth.svelte.ts`, kein eigenes Token-System wie bei Display/Binocular.
 *
 * "Veranstaltung" ↔ Fawkes-"Fixture" ist 1:1 (mit Backend-Entwickler geklärt, siehe Issue #14) —
 * `id`/`uniqueId`/`date`/`location`/`leagueName`/`fixtureName` entsprechen 1:1
 * `GetFixtureResponse`. Name der Veranstaltung ist Liganame + Wettkampftag, kein einzelnes
 * `name`-Feld wie in einer früheren, unbestätigten Annahme dieses Moduls.
 *
 * Spielplan (Stand 2026-10-05, Backend live): es gibt keinen Lese-Endpunkt. Angelegt wird er per
 * `POST /fixtures/{fixtureId}/matchplaychart`, gelesen wird er zusammengesetzt aus
 * `GET /fixtures/{fixtureId}/rounds/{roundNo}` (`matchkontrolleApi.loadRounds`). Die initialen
 * Tabellenpunkte der Teams sind daher NICHT zurücklesbar — nur Mannschaftsnamen und Rundenzahl.
 */

export interface LigaVerbindung {
	liga_app: string;
	url: string;
	login_pin: string;
	digitaler_schusszettel: boolean;
}

export interface Veranstaltung {
	/** Fawkes-Fixture-ID (numerisch) — steuert u. a. `PUT/GET /fixtures/{fixtureId}/phase`
	 * (Matchkontrolle, #10) und `/fixtures/{id}/users...` (Mitgliederverwaltung, #13). */
	id: number;
	/** Schwer zu erraten, Bearer-frei nutzbar — steuert die Spotter-Info-Abfragen. */
	uniqueId: string;
	/** ISO-8601 UTC. */
	date: string;
	location: string;
	leagueName: string;
	fixtureName: string;
	/**
	 * Mock-only-Zusatzfelder, NICHT Teil von `GetFixtureResponse` — degradieren gegen ein
	 * echtes Backend zu `undefined`. `datenquelle`/`liga` bleiben bewusst reine
	 * Verwaltungs-UI-Konzepte: Liga-Verbindung hat laut Issue #14 keinen Fawkes-Endpunkt (bleibt
	 * vollständig Mock-only), "tabelle" ist hier nur eine Vorschau für die Übersichtsliste — die
	 * eigentliche Quelle sind die Runden (`getMatchPlayChart`, siehe unten).
	 */
	datenquelle?: 'tabelle' | 'liga' | null;
	liga?: LigaVerbindung;
}

export interface CreateFixtureData {
	date: string;
	location: string;
	leagueName: string;
	fixtureName: string;
}

/**
 * Fixture-bezogene Mitgliedschaft (`Fawkes.Api.Controllers.FixtureController.GetUserResponse`),
 * separate Achse von der Account-`role` (siehe CLAUDE.md "Permissions/roles") — Ersteller einer
 * Fixture (`POST /Fixture`) wird automatisch Owner, nur Owner dürfen Mitglieder verwalten
 * (Rücksprache Backend-Entwickler 2026-08-17, siehe Issue #13). `userName` = die E-Mail-Adresse
 * des Accounts (kein separates Username-Feld sonst im Kontrakt, ASP.NET-Identity-Standard) —
 * vom Backend nicht bestätigt.
 */
export interface FixtureUser {
	userName: string;
	isOwner: boolean;
}

/** `Fawkes.Api.Controllers.MatchPlayChartController.Team` — Werte VOR dieser Fixture. */
export interface MatchPlayChartTeam {
	name: string;
	setPointsWon: number;
	setPointsLost: number;
	matchPointsWon: number;
	matchPointsLost: number;
}

/** Aus den Runden rekonstruierter Spielplan (kein eigener GET, siehe Modulkommentar). */
export interface MatchPlayChart {
	fixtureId: number;
	/** In Reihenfolge der Scheiben in Runde 1; leer = noch kein Spielplan angelegt. */
	teamNames: string[];
	roundCount: number;
}

export const veranstaltungApi = {
	list: (token: string) => apiClient.get<Veranstaltung[]>('/fixtures', token),

	get: (token: string, id: number) => apiClient.get<Veranstaltung>(`/fixtures/${id}`, token),

	create: (token: string, data: CreateFixtureData) =>
		apiClient.post<Veranstaltung>('/fixtures', data, token),

	// Von keiner UI aktuell aufgerufen (kein Bearbeiten-Formular existiert) — trotzdem verdrahtet,
	// damit der Kontrakt vollständig zu CreateFixtureRequest/UpdateFixtureRequest passt (#14).
	update: (token: string, id: number, data: CreateFixtureData) =>
		apiClient.put<Veranstaltung>(`/fixtures/${id}`, data, token),

	remove: (token: string, id: number) => apiClient.delete<void>(`/fixtures/${id}`, token),

	// Kein GET-Endpunkt: Runden ab 1 laden, bis keine mehr kommt (siehe Modulkommentar).
	getMatchPlayChart: async (token: string, fixtureId: number): Promise<MatchPlayChart> => {
		const rounds = await matchkontrolleApi.loadRounds(token, fixtureId);
		const firstRound = [...(rounds[0]?.targets ?? [])].sort((a, b) => a.targetNo - b.targetNo);
		const teamNames = [
			...new Set(firstRound.map((t) => t.teamName).filter((n): n is string => !!n))
		];
		return { fixtureId, teamNames, roundCount: rounds.length };
	},

	// "Spielplan anlegen": Tabelle eintragen -> Backend berechnet Begegnungen/Matches
	// (targetAssignments bewusst weggelassen, siehe FACHLICHKEIT.md "keine eigenen Ergebnisse
	// berechnen"). Antwort: bare 200 ohne Body. Ohne hardOverride schlägt der Request mit 400
	// ("Match play chart already exists ...") fehl, sobald für diese Fixture schon Daten
	// existieren. hardOverride: true überschreibt trotzdem — löscht dabei alle bereits
	// erfassten Ergebnisse und erstellt den Spielplan neu (mit Backend-Entwickler bestätigt,
	// UI muss also vor dem Aufruf warnen, siehe veranstaltungen/[id]/+page.svelte).
	// Ohne `targetAssignments` kennt das Backend (2026-10-05) nur einen Standard-Spielplan für
	// 7 oder 8 Mannschaften, sonst 400 "No default match play chart available for N teams." —
	// Achtung: mit hardOverride ist der alte Spielplan dann bereits gelöscht.
	createMatchPlayChart: (
		token: string,
		fixtureId: number,
		teams: MatchPlayChartTeam[],
		hardOverride = false
	) =>
		apiClient.post<void>(`/fixtures/${fixtureId}/matchplaychart`, { teams, hardOverride }, token),

	// Kein Fawkes-Endpunkt für Ligaverwaltungs-Verbindung (siehe Issue #14) — bleibt vollständig
	// Mock-only, eigener Custom-Pfad.
	connectLiga: (token: string, id: number, data: LigaVerbindung) =>
		apiClient.post<Veranstaltung>(`/veranstaltungen/${id}/liga`, data, token),

	listUsers: (token: string, fixtureId: number) =>
		apiClient.get<FixtureUser[]>(`/fixtures/${fixtureId}/users`, token),

	// Antwort laut Spec nur bare 200 ohne Body-Schema — Aufrufer lädt die Liste danach neu.
	addUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.post<void>(`/fixtures/${fixtureId}/users/add`, { userName }, token),

	removeUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.delete<void>(`/fixtures/${fixtureId}/users/${encodeURIComponent(userName)}`, token)
};
