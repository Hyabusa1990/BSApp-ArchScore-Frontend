import { apiClient } from './client';

/**
 * Verwaltungsoberfläche — einziger Bereich mit echtem Benutzerkonto-Login (siehe
 * FACHLICHKEIT.md). Auth läuft über den bestehenden Account-`access_token` aus
 * `auth.svelte.ts`, kein eigenes Token-System wie bei Display/Binocular.
 *
 * Mockups dazu sind Entwurf, nicht abgestimmt — Shapes hier sind eine angemessene
 * Annahme, kein exaktes Nachbauen einer Spezifikation.
 */

/** Eingabedaten der initialen Tabelle (Admin trägt Ausgangsstand ein) — bewusst ein
 * eigener, schlankerer Typ als `TabellenEintrag` aus display.ts: das dort ist die vom
 * Backend aufbereitete, laufend aktualisierte Anzeige-Tabelle (mit matchpunkte_neg/
 * satzpunkte_netto), hier ist es reine, einmalige Admin-Eingabe. */
export interface InitialeTabelleEintrag {
	platz: number;
	mannschaft_name: string;
	satzpunkte: number;
	matchpunkte: number;
}

export interface LigaVerbindung {
	liga_app: string;
	url: string;
	login_pin: string;
	digitaler_schusszettel: boolean;
}

export interface Veranstaltung {
	id: string;
	owner_id: string;
	name: string;
	/** null = noch keine Datenquelle eingerichtet. */
	datenquelle: 'tabelle' | 'liga' | null;
	tabelle?: InitialeTabelleEintrag[];
	liga?: LigaVerbindung;
	/**
	 * Fawkes-Fixture, die diese Veranstaltung repräsentiert — Annahme 1 Veranstaltung = 1
	 * Fixture (passt zur Fixture-Granularität "3. Wettkampftag"/"Finale"), vom Backend nicht
	 * bestätigt (siehe Issue #10). `fixtureId` (numerisch, Bearer-authentifiziert) steuert
	 * `PUT/GET /fixtures/{fixtureId}/phase`, `fixtureUniqueId` (schwer zu erraten, Bearer-frei)
	 * die Spotter-Info-Abfragen für die Confirm-Status-Anzeige.
	 */
	fixtureId: number;
	fixtureUniqueId: string;
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

export const veranstaltungApi = {
	list: (token: string) => apiClient.get<Veranstaltung[]>('/veranstaltungen', token),

	get: (token: string, id: string) => apiClient.get<Veranstaltung>(`/veranstaltungen/${id}`, token),

	create: (token: string, name: string) =>
		apiClient.post<Veranstaltung>('/veranstaltungen', { name }, token),

	remove: (token: string, id: string) => apiClient.delete<void>(`/veranstaltungen/${id}`, token),

	// "Spielplan anlegen": Tabelle eintragen -> Backend berechnet Begegnungen/Matches.
	setTabelle: (token: string, id: string, eintraege: InitialeTabelleEintrag[]) =>
		apiClient.post<Veranstaltung>(`/veranstaltungen/${id}/tabelle`, { eintraege }, token),

	// "Spielplan löschen".
	clearTabelle: (token: string, id: string) =>
		apiClient.delete<Veranstaltung>(`/veranstaltungen/${id}/tabelle`, token),

	connectLiga: (token: string, id: string, data: LigaVerbindung) =>
		apiClient.post<Veranstaltung>(`/veranstaltungen/${id}/liga`, data, token),

	listUsers: (token: string, fixtureId: number) =>
		apiClient.get<FixtureUser[]>(`/Fixture/${fixtureId}/users`, token),

	// Antwort laut Spec nur bare 200 ohne Body-Schema — Aufrufer lädt die Liste danach neu.
	addUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.post<void>(`/Fixture/${fixtureId}/users/add`, { userName }, token),

	removeUser: (token: string, fixtureId: number, userName: string) =>
		apiClient.delete<void>(`/Fixture/${fixtureId}/users/${encodeURIComponent(userName)}`, token)
};
