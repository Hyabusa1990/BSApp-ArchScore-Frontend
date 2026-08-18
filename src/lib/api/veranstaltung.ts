import { apiClient } from './client';

/**
 * Verwaltungsoberfläche — einziger Bereich mit echtem Benutzerkonto-Login (siehe
 * FACHLICHKEIT.md). Auth läuft über den bestehenden Account-`access_token` aus
 * `auth.svelte.ts`, kein eigenes Token-System wie bei Display/Binocular.
 *
 * "Veranstaltung" ↔ Fawkes-"Fixture" ist 1:1 (mit Backend-Entwickler geklärt, siehe Issue #14) —
 * `id`/`uniqueId`/`date`/`location`/`leagueName`/`fixtureName` entsprechen 1:1
 * `GetFixtureResponse`. Name der Veranstaltung ist Liganame + Wettkampftag, kein einzelnes
 * `name`-Feld wie in einer früheren, unbestätigten Annahme dieses Moduls.
 */

export interface LigaVerbindung {
	liga_app: string;
	url: string;
	login_pin: string;
	digitaler_schusszettel: boolean;
}

export interface Veranstaltung {
	/** Fawkes-Fixture-ID (numerisch) — steuert u. a. `PUT/GET /fixtures/{fixtureId}/phase`
	 * (Matchkontrolle, #10) und `/Fixture/{id}/users...` (Mitgliederverwaltung, #13). */
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
	 * eigentliche Quelle ist `GET /MatchPlayChart/{fixtureId}` (separat abgefragt, siehe unten).
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
	setPoints: number;
	matchPoints: number;
}

export interface MatchPlayChart {
	fixtureId: number;
	teams: MatchPlayChartTeam[];
	/** 1-indiziert pro Runde, 0 = leere Scheibe — hier bewusst nie gesetzt, siehe
	 * `createMatchPlayChart`. */
	targetAssignments?: number[][];
}

export const veranstaltungApi = {
	list: (token: string) => apiClient.get<Veranstaltung[]>('/Fixture', token),

	get: (token: string, id: number) => apiClient.get<Veranstaltung>(`/Fixture/${id}`, token),

	create: (token: string, data: CreateFixtureData) =>
		apiClient.post<Veranstaltung>('/Fixture', data, token),

	// Von keiner UI aktuell aufgerufen (kein Bearbeiten-Formular existiert) — trotzdem verdrahtet,
	// damit der Kontrakt vollständig zu CreateFixtureRequest/UpdateFixtureRequest passt (#14).
	update: (token: string, id: number, data: CreateFixtureData) =>
		apiClient.put<Veranstaltung>(`/Fixture/${id}`, data, token),

	remove: (token: string, id: number) => apiClient.delete<void>(`/Fixture/${id}`, token),

	getMatchPlayChart: (token: string, fixtureId: number) =>
		apiClient.get<MatchPlayChart>(`/MatchPlayChart/${fixtureId}`, token),

	// "Spielplan anlegen": Tabelle eintragen -> Backend berechnet Begegnungen/Matches
	// (targetAssignments bewusst weggelassen, siehe FACHLICHKEIT.md "keine eigenen Ergebnisse
	// berechnen"). hardOverride bewusst nicht gesetzt (#14) — Standardverhalten: Fehler, wenn
	// für diese Fixture schon Daten existieren. Kein Lösch-/Reset-Endpunkt verifiziert, daher
	// gibt es hier absichtlich kein clearTabelle-Äquivalent mehr.
	createMatchPlayChart: (token: string, fixtureId: number, teams: MatchPlayChartTeam[]) =>
		apiClient.post<MatchPlayChart>(`/MatchPlayChart/${fixtureId}`, { teams }, token),

	// Kein Fawkes-Endpunkt für Ligaverwaltungs-Verbindung (siehe Issue #14) — bleibt vollständig
	// Mock-only, eigener Custom-Pfad.
	connectLiga: (token: string, id: number, data: LigaVerbindung) =>
		apiClient.post<Veranstaltung>(`/veranstaltungen/${id}/liga`, data, token),

	listUsers: (token: string, fixtureId: number) =>
		apiClient.get<FixtureUser[]>(`/Fixture/${fixtureId}/users`, token),

	// Antwort laut Spec nur bare 200 ohne Body-Schema — Aufrufer lädt die Liste danach neu.
	addUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.post<void>(`/Fixture/${fixtureId}/users/add`, { userName }, token),

	removeUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.delete<void>(`/Fixture/${fixtureId}/users/${encodeURIComponent(userName)}`, token)
};
