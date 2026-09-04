import type { User } from '$lib/api/auth';
import type {
	Veranstaltung,
	CreateFixtureData,
	FixtureUser,
	MatchPlayChart,
	MatchPlayChartTeam
} from '$lib/api/veranstaltung';
import type { LeagueTablePosition } from '$lib/api/display';
import type { Match, Begegnung, RoundTarget } from '$lib/api/matchkontrolle';
import type { Device, UpdateDeviceData } from '$lib/api/bildschirme';
import { users } from './fixtures';
import { loadState, saveState } from './persist';
import { berechneMatchStand } from './shared-state';

/**
 * Fake-Backend-Zustand für die Verwaltungsoberfläche — ein gemeinsamer Store für
 * Veranstaltung/Match/Gerät (referenzieren sich gegenseitig über veranstaltung_id).
 * Weiterhin eigenständig ggü. db.ts (auth-spezifisch), aber jetzt die Quelle, aus der
 * displays.ts/binoculars.ts ihren Zustand lesen (welches Match ist aktiv, welches Gerät/
 * Tablet-Token gehört wozu) — siehe Issue #10.
 *
 * Über `localStorage` persistiert (siehe persist.ts): Admin-Verwaltung, Display und
 * Spotter-Tablet laufen in der Realität auf verschiedenen Geräten, im Dev-Setup simuliert
 * durch verschiedene Browser-Tabs — reine Modul-Variablen wären dafür NICHT konsistent,
 * jeder Tab hat seinen eigenen JS-Kontext. Jede Funktion liest den Zustand deshalb frisch
 * und schreibt ihn nach jeder Änderung zurück, statt ihn einmalig beim Modul-Load zu laden.
 *
 * `Veranstaltung.id` ist seit Issue #14 die echte numerische Fawkes-Fixture-ID — alle anderen
 * hier gespeicherten Records (Match/Device/currentRoundNo/fixtureUsers/matchPlayCharts)
 * referenzieren sie weiterhin über einen STRING-Schlüssel (`String(v.id)`),
 * das sind rein interne Mock-Konzepte ohne echtes Fawkes-Pendant, ihr Schlüsseltyp ist bewusst
 * unverändert geblieben (kleinerer Diff, kein Fawkes-Kontrakt zu verletzen).
 */

/**
 * Intern gehaltene Erweiterung von `Device` um den `deviceCode`, mit dem sich das Gerät
 * ursprünglich registriert hat (Issue #17) — nicht Teil von `GetDeviceResponse` (die echte
 * Fawkes-Antwort an die Admin-UI kennt nur `id`/`displayType`/`matchNo`), deshalb beim
 * Rausreichen an Admin-Handler immer über `toPublicDevice` strippen. Bleibt nach dem Zuordnen
 * erhalten, damit `/Display/data` das Gerät anhand seines `deviceCode` wiederfinden kann.
 */
interface StoredDevice extends Device {
	deviceCode: string;
}

/** Intern gespeicherte Match-Daten ohne `aktiv` — das Freigabe-Flag ist seit #10 rein aus
 * `currentRoundNo` (Fawkes-`roundNo`) abgeleitet, nicht mehr selbst persistiert. */
type StoredMatch = Omit<Match, 'aktiv'>;

interface State {
	veranstaltungen: Veranstaltung[];
	matches: StoredMatch[];
	/** Veranstaltungs-ID (String) -> aktuell freigegebene Runde (Fawkes-`roundNo`, Issue #10). */
	currentRoundNo: Record<string, number>;
	/** Veranstaltungs-ID (String) -> Fixture-Mitglieder (Fawkes `GetUserResponse[]`, Issue #13). */
	fixtureUsers: Record<string, FixtureUser[]>;
	/** Veranstaltungs-ID (String) -> initiale Tabelle (`GetMatchPlayChartResponse`, Issue #14). */
	matchPlayCharts: Record<string, MatchPlayChart>;
	/** Veranstaltungs-ID (String) -> Ligatabelle, wie sie ein `LeagueTable`-Gerät anzeigt (Issue
	 * #18) — eigene Datenquelle ggü. `matchPlayCharts` (andere Feldnamen, siehe `display.ts`),
	 * bewusst nur für Veranstaltungen mit `datenquelle === 'liga'` gepflegt. */
	leagueTables: Record<string, LeagueTablePosition[]>;
	/** Veranstaltungs-ID (String) -> zugewiesene Geräte (Fawkes `GetDeviceResponse[]`, Issue #15). */
	devices: Record<string, StoredDevice[]>;
	/** deviceCodes, die sich schon selbst registriert haben (`GET /Display/register`, Issue #17),
	 * aber noch keiner Fixture zugeordnet sind — derselbe Pool, den `assignDevice` prüft. */
	pendingDeviceCodes: string[];
	nextId: number;
}

function toMatch(state: State, m: StoredMatch): Match {
	return { ...m, aktiv: state.currentRoundNo[m.veranstaltung_id] === m.nummer };
}

function seedState(): State {
	return {
		veranstaltungen: [
			{
				id: 1001,
				uniqueId: 'f1e57000-0000-4000-8000-000000000001',
				date: '2026-09-05T09:00:00Z',
				location: 'Sporthalle Abendau',
				leagueName: '1. Bundesliga Nord',
				fixtureName: '1. Wettkampftag',
				datenquelle: 'tabelle'
			},
			{
				id: 1002,
				uniqueId: 'f1e57000-0000-4000-8000-000000000002',
				date: '2026-09-12T09:00:00Z',
				location: 'Schützenhalle Ost',
				leagueName: 'Kreisliga Ost',
				fixtureName: '1. Wettkampftag',
				datenquelle: 'liga',
				liga: {
					liga_app: 'BSApp Liga',
					url: 'https://liga.bsapp.de',
					login_pin: 'A689HL5',
					digitaler_schusszettel: true
				}
			}
		],
		// Volle Setzliste für 8 Mannschaften / 7 Matches (Rücksprache Gero, Screenshot
		// "Setzliste von Match zu Match" 2026-09-04) — Kreisverfahren (jede Mannschaft einmal
		// gegen jede andere), feste Scheiben-Paarung 1/2, 3/4, 5/6, 7/8 pro Match (FACHLICHKEIT.md).
		// Mannschafts-Nummern 1–8 der Setzliste entsprechen der Reihenfolge in
		// `matchPlayCharts['1001'].teams` unten (1=BSC Abendau … 8=BSC Rot-Rot Beerendorf).
		matches: [
			{
				id: 'm-1',
				veranstaltung_id: '1001',
				nummer: 1,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'SV Vogelwiese',
						mannschaft_b: 'BS Hunshausen'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'SV Scharfhaus',
						mannschaft_b: 'SGi Wuppenhausen'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'BSC Abendau',
						mannschaft_b: 'BSC Rot-Rot Beerendorf'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'SGes Schützenschaft',
						mannschaft_b: 'BS Weiß-Blau München'
					}
				]
			},
			{
				id: 'm-2',
				veranstaltung_id: '1001',
				nummer: 2,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'SGes Schützenschaft',
						mannschaft_b: 'SV Vogelwiese'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'BSC Rot-Rot Beerendorf',
						mannschaft_b: 'BS Hunshausen'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'SGi Wuppenhausen',
						mannschaft_b: 'BSC Abendau'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'BS Weiß-Blau München',
						mannschaft_b: 'SV Scharfhaus'
					}
				]
			},
			{
				id: 'm-3',
				veranstaltung_id: '1001',
				nummer: 3,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'BS Hunshausen',
						mannschaft_b: 'SGi Wuppenhausen'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'BSC Abendau',
						mannschaft_b: 'BS Weiß-Blau München'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'SV Scharfhaus',
						mannschaft_b: 'SV Vogelwiese'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'BSC Rot-Rot Beerendorf',
						mannschaft_b: 'SGes Schützenschaft'
					}
				]
			},
			{
				id: 'm-4',
				veranstaltung_id: '1001',
				nummer: 4,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'BSC Rot-Rot Beerendorf',
						mannschaft_b: 'SV Scharfhaus'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'SGi Wuppenhausen',
						mannschaft_b: 'SGes Schützenschaft'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'BS Weiß-Blau München',
						mannschaft_b: 'BS Hunshausen'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'BSC Abendau',
						mannschaft_b: 'SV Vogelwiese'
					}
				]
			},
			{
				id: 'm-5',
				veranstaltung_id: '1001',
				nummer: 5,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'SGi Wuppenhausen',
						mannschaft_b: 'BS Weiß-Blau München'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'SV Vogelwiese',
						mannschaft_b: 'BSC Rot-Rot Beerendorf'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'SGes Schützenschaft',
						mannschaft_b: 'SV Scharfhaus'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'BS Hunshausen',
						mannschaft_b: 'BSC Abendau'
					}
				]
			},
			{
				id: 'm-6',
				veranstaltung_id: '1001',
				nummer: 6,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'BSC Abendau',
						mannschaft_b: 'SGes Schützenschaft'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'BS Hunshausen',
						mannschaft_b: 'SV Scharfhaus'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'BSC Rot-Rot Beerendorf',
						mannschaft_b: 'BS Weiß-Blau München'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'SV Vogelwiese',
						mannschaft_b: 'SGi Wuppenhausen'
					}
				]
			},
			{
				id: 'm-7',
				veranstaltung_id: '1001',
				nummer: 7,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'SV Scharfhaus',
						mannschaft_b: 'BSC Abendau'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'BS Weiß-Blau München',
						mannschaft_b: 'SV Vogelwiese'
					},
					{
						scheibe_a: 5,
						scheibe_b: 6,
						mannschaft_a: 'BS Hunshausen',
						mannschaft_b: 'SGes Schützenschaft'
					},
					{
						scheibe_a: 7,
						scheibe_b: 8,
						mannschaft_a: 'SGi Wuppenhausen',
						mannschaft_b: 'BSC Rot-Rot Beerendorf'
					}
				]
			}
		],
		currentRoundNo: { '1001': 1 },
		fixtureUsers: {
			'1001': [{ userName: users.admin.email, isOwner: true }],
			'1002': [{ userName: users.member.email, isOwner: true }]
		},
		matchPlayCharts: {
			'1001': {
				fixtureId: 1001,
				teams: [
					{ name: 'BSC Abendau', setPoints: 15, matchPoints: 14 },
					{ name: 'SV Scharfhaus', setPoints: 7, matchPoints: 11 },
					{ name: 'SGes Schützenschaft', setPoints: -5, matchPoints: 11 },
					{ name: 'BS Hunshausen', setPoints: 12, matchPoints: 6 },
					{ name: 'SV Vogelwiese', setPoints: 8, matchPoints: 8 },
					{ name: 'BS Weiß-Blau München', setPoints: -10, matchPoints: 2 },
					{ name: 'SGi Wuppenhausen', setPoints: -22, matchPoints: 2 },
					{ name: 'BSC Rot-Rot Beerendorf', setPoints: -15, matchPoints: 0 }
				]
			}
		},
		devices: {
			'1001': [
				{
					id: 500,
					displayType: 'Match',
					matchNo: 1,
					displayTheme: 'Dark',
					deviceCode: 'DEV-SEED01'
				}
			],
			'1002': [
				{
					id: 501,
					displayType: 'LeagueTable',
					matchNo: null,
					displayTheme: 'Light',
					deviceCode: 'DEV-SEED02'
				}
			]
		},
		leagueTables: {
			'1002': [
				{
					teamName: 'BSC Nordlicht',
					setPointsWon: 22,
					setPointsLost: 6,
					matchPointsWon: 12,
					matchPointsLost: 2,
					position: 1
				},
				{
					teamName: 'SV Kreisstadt',
					setPointsWon: 18,
					setPointsLost: 10,
					matchPointsWon: 9,
					matchPointsLost: 5,
					position: 2
				},
				{
					teamName: 'BS Ostwind',
					setPointsWon: 15,
					setPointsLost: 13,
					matchPointsWon: 8,
					matchPointsLost: 6,
					position: 3
				},
				{
					teamName: 'SGi Talblick',
					setPointsWon: 12,
					setPointsLost: 16,
					matchPointsWon: 6,
					matchPointsLost: 8,
					position: 4
				}
			]
		},
		pendingDeviceCodes: ['DEV-A1B2C3', 'DEV-D4E5F6', 'DEV-G7H8I9'],
		nextId: 2000
	};
}

const STORAGE_KEY = 'veranstaltungen';

function load(): State {
	return loadState(STORAGE_KEY, seedState);
}

function persist(state: State): void {
	saveState(STORAGE_KEY, state);
}

function generateId(state: State, prefix: string): string {
	return `${prefix}-${state.nextId++}`;
}

// Sichtbarkeit läuft seit #14 über echte Fixture-Mitgliedschaft (usersFor/fixtureUsers, #13)
// statt eines Mock-only owner_id-Feldes — schließt die in #13 offen gelassene Lücke: ein
// hinzugefügter Nicht-Owner sieht/öffnet die Veranstaltung jetzt genauso wie der Owner.
export function canSee(user: User, v: Veranstaltung): boolean {
	return user.role === 'admin' || usersFor(String(v.id)).some((u) => u.userName === user.email);
}

export function visibleVeranstaltungen(user: User): Veranstaltung[] {
	return load().veranstaltungen.filter((v) => canSee(user, v));
}

export function findVeranstaltung(user: User, id: number): Veranstaltung | undefined {
	const v = load().veranstaltungen.find((v) => v.id === id);
	return v && canSee(user, v) ? v : undefined;
}

/** Ungefiltert wie `findAssignedDeviceByCode` weiter unten — der echte Spotter-Info-Endpunkt ist
 * laut Fawkes-Spec Bearer-frei, die schwer zu erratende `uniqueId` selbst ist die Absicherung
 * (siehe binocular.ts). Doppelt genutzt: von der Matchkontrolle, um den Confirm-Status pro
 * Scheibe zu lesen (Issue #10), UND vom Tablet-QR direkt als Pairing-„Token" (Issue #22 —
 * ersetzt den vormaligen eigenen `generateTabletToken`-Mechanismus, kein Fawkes-Endpunkt dafür
 * nötig, die `uniqueId` ist schon die Absicherung). */
export function findVeranstaltungByUniqueId(uniqueId: string): Veranstaltung | undefined {
	return load().veranstaltungen.find((v) => v.uniqueId === uniqueId);
}

export function usersFor(veranstaltungId: string): FixtureUser[] {
	return load().fixtureUsers[veranstaltungId] ?? [];
}

export function isFixtureOwner(veranstaltungId: string, userName: string): boolean {
	return usersFor(veranstaltungId).some((u) => u.userName === userName && u.isOwner);
}

/** Fügt einen Nicht-Owner hinzu (Owner-Check läuft im Handler, nicht hier) — no-op bei bereits
 * vorhandenem userName statt Duplikat. */
export function addFixtureUser(veranstaltungId: string, userName: string): FixtureUser[] {
	const state = load();
	const list = (state.fixtureUsers[veranstaltungId] ??= []);
	if (!list.some((u) => u.userName === userName)) {
		list.push({ userName, isOwner: false });
	}
	persist(state);
	return list;
}

export function removeFixtureUser(veranstaltungId: string, userName: string): FixtureUser[] {
	const state = load();
	state.fixtureUsers[veranstaltungId] = usersFor(veranstaltungId).filter(
		(u) => u.userName !== userName
	);
	persist(state);
	return state.fixtureUsers[veranstaltungId];
}

export function createVeranstaltung(user: User, data: CreateFixtureData): Veranstaltung {
	const state = load();
	const v: Veranstaltung = {
		id: state.nextId++,
		uniqueId: crypto.randomUUID(),
		...data,
		datenquelle: null
	};
	state.veranstaltungen.push(v);
	// Ersteller wird automatisch Owner (Rücksprache Backend-Entwickler 2026-08-17, Issue #13).
	state.fixtureUsers[String(v.id)] = [{ userName: user.email, isOwner: true }];
	persist(state);
	return v;
}

export function removeVeranstaltung(user: User, id: number): boolean {
	const state = load();
	const v = state.veranstaltungen.find((v) => v.id === id);
	if (!v || !canSee(user, v)) return false;
	state.veranstaltungen.splice(state.veranstaltungen.indexOf(v), 1);
	persist(state);
	return true;
}

// Reine Mock-Vereinfachung: erzeugt EINEN Demo-Match statt eines echten Spielplans —
// die tatsächliche Berechnung (Round-Robin etc.) ist Backend-Sache, siehe FACHLICHKEIT.md
// "Diese App berechnet keine eigenen Ergebnisse". Ziel hier ist nur, dass #7/#8 danach
// etwas zum Anzeigen haben.
function ensureDemoMatch(state: State, v: Veranstaltung, teams: MatchPlayChartTeam[]) {
	const id = String(v.id);
	if (state.matches.some((m) => m.veranstaltung_id === id)) return;
	state.matches.push({
		id: generateId(state, 'm'),
		veranstaltung_id: id,
		nummer: 1,
		begegnungen: [
			{
				scheibe_a: 1,
				scheibe_b: 2,
				mannschaft_a: teams[0]?.name ?? 'Mannschaft A',
				mannschaft_b: teams[1]?.name ?? 'Mannschaft B'
			}
		]
	});
	state.currentRoundNo[id] = 1;
}

export function getMatchPlayChart(fixtureId: number): MatchPlayChart | undefined {
	return load().matchPlayCharts[String(fixtureId)];
}

/**
 * Sortierung wie in einer echten Ligatabelle üblich: Matchpunkte absteigend, bei Gleichstand
 * Satzpunkte absteigend als Tiebreak. `MatchPlayChartTeam` kennt nur je eine Netto-Zahl (Admin
 * gibt keine Plus/Minus-Aufteilung ein, siehe `saveTabelle`), deshalb Plus/Minus hier synthetisch
 * aus dem Vorzeichen rekonstruiert (negativ -> komplett in Minus, sonst komplett in Plus) — reine
 * Mock-Annäherung, keine echte Sieg/Niederlage-Historie.
 */
function toLeagueTablePositions(teams: MatchPlayChartTeam[]): LeagueTablePosition[] {
	return [...teams]
		.sort((a, b) => b.matchPoints - a.matchPoints || b.setPoints - a.setPoints)
		.map((team, i) => ({
			teamName: team.name,
			setPointsWon: Math.max(team.setPoints, 0),
			setPointsLost: Math.max(-team.setPoints, 0),
			matchPointsWon: Math.max(team.matchPoints, 0),
			matchPointsLost: Math.max(-team.matchPoints, 0),
			position: i + 1
		}));
}

/**
 * Ligatabelle für ein `LeagueTable`-Gerät (Issue #18) — leeres Array, wenn (noch) keine Daten
 * vorliegen, nicht `undefined`, damit `getDisplayData` nicht extra unterscheiden muss. Explizit
 * gepflegte `leagueTables` (externe Liga-Anbindung) haben Vorrang; ohne die fällt es auf die
 * initiale Tabelle zurück (`matchPlayCharts`, "Tabelle eintragen" im Veranstaltungs-Formular) —
 * dieselben Standings, die auch in der Verwaltungsoberfläche angezeigt werden.
 */
export function getLeagueTable(veranstaltungId: string): LeagueTablePosition[] {
	const state = load();
	const explizit = state.leagueTables[veranstaltungId];
	if (explizit) return explizit;
	const chart = state.matchPlayCharts[veranstaltungId];
	return chart ? toLeagueTablePositions(chart.teams) : [];
}

/**
 * Entspricht `POST /MatchPlayChart/{fixtureId}` ohne `hardOverride` (Issue #14): schlägt fehl,
 * wenn für diese Fixture schon eine Tabelle existiert — kein Reset-/Lösch-Pfad hier, weil dafür
 * kein echter Endpunkt verifiziert ist (siehe `veranstaltung.ts`). `undefined` = Konflikt.
 */
export function createMatchPlayChart(
	v: Veranstaltung,
	teams: MatchPlayChartTeam[],
	hardOverride = false
): MatchPlayChart | undefined {
	const state = load();
	const id = String(v.id);
	if (state.matchPlayCharts[id] && !hardOverride) return undefined;

	if (hardOverride) {
		// Spiegelt das echte `hardOverride`-Verhalten (Rücksprache Gero, 2026-08-31): löscht
		// alle bisher erfassten Ergebnisse dieser Fixture, bevor der Spielplan neu erstellt wird.
		state.matches = state.matches.filter((m) => m.veranstaltung_id !== id);
		delete state.currentRoundNo[id];
	}

	const chart: MatchPlayChart = { fixtureId: v.id, teams };
	state.matchPlayCharts[id] = chart;

	const target = state.veranstaltungen.find((x) => x.id === v.id) ?? v;
	target.datenquelle = 'tabelle';
	target.liga = undefined;
	ensureDemoMatch(state, target, teams);

	persist(state);
	return chart;
}

export function connectLiga(
	v: Veranstaltung,
	liga: NonNullable<Veranstaltung['liga']>
): Veranstaltung {
	const state = load();
	const target = state.veranstaltungen.find((x) => x.id === v.id) ?? v;
	target.datenquelle = 'liga';
	target.liga = liga;
	ensureDemoMatch(state, target, []);
	persist(state);
	return target;
}

export function matchesFor(veranstaltungId: string): Match[] {
	const state = load();
	return state.matches
		.filter((m) => m.veranstaltung_id === veranstaltungId)
		.map((m) => toMatch(state, m));
}

/** Aktuell freigegebene Runde (Fawkes-`roundNo`) der Veranstaltung, falls schon gesetzt. */
export function getCurrentRoundNo(veranstaltungId: string): number | undefined {
	return load().currentRoundNo[veranstaltungId];
}

/**
 * Setzt die freigegebene Runde — entspricht `PUT /fixtures/{fixtureId}/phase` (nur `roundNo`,
 * siehe Issue #10, korrigiert #5/#7/#8: keine `setNo`-Auswahl mehr bei der Freigabe selbst).
 * `Match.aktiv` wird dadurch nicht mehr direkt gesetzt, sondern beim nächsten `matchesFor`-Read
 * aus `nummer === roundNo` abgeleitet — siehe `toMatch`.
 */
export function setCurrentRoundNo(veranstaltungId: string, roundNo: number): Match[] {
	const state = load();
	state.currentRoundNo[veranstaltungId] = roundNo;
	persist(state);
	return matchesFor(veranstaltungId);
}

// ── Geräteverwaltung (Fawkes `DeviceManagementController`/`DisplayController`, Issue #15/#17) ──

function randomDeviceCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (0/O, 1/I)
	const suffix = Array.from(
		{ length: 6 },
		() => chars[Math.floor(Math.random() * chars.length)]
	).join('');
	return `DEV-${suffix}`;
}

/** Nie an Admin-Handler durchreichen — `GetDeviceResponse` kennt kein `deviceCode`-Feld. */
function toPublicDevice({ id, displayType, matchNo, displayTheme }: StoredDevice): Device {
	return { id, displayType, matchNo, displayTheme };
}

export function devicesFor(veranstaltungId: string): Device[] {
	return (load().devices[veranstaltungId] ?? []).map(toPublicDevice);
}

export function findDevice(veranstaltungId: string, deviceId: number): Device | undefined {
	const d = (load().devices[veranstaltungId] ?? []).find((d) => d.id === deviceId);
	return d && toPublicDevice(d);
}

/**
 * Simuliert die Selbst-Registrierung eines Geräts (`GET /Display/register`, Issue #17) — legt
 * einen frischen, noch unzugewiesenen `deviceCode` im selben Pool an, den `assignDevice` prüft.
 * Vorher (Issue #15) war dieser Pool nur mit drei festen Seed-Codes gefüllt und `/display`
 * sprach ein komplett getrenntes PIN-System — ein am Display angezeigter Code ließ sich dadurch
 * im Admin-Zuordnen nie tatsächlich einlösen.
 */
export function registerDeviceCode(): string {
	const state = load();
	const code = randomDeviceCode();
	state.pendingDeviceCodes.push(code);
	persist(state);
	return code;
}

/**
 * Ordnet ein bereits "registriertes" Gerät (Pool simulierter deviceCodes, siehe
 * `pendingDeviceCodes`) einer Fixture zu — entspricht `PUT /fixtures/{fixtureId}/devices/assign`.
 * `undefined` = deviceCode unbekannt oder schon zugewiesen.
 */
export function assignDevice(veranstaltungId: string, deviceCode: string): Device | undefined {
	const state = load();
	const index = state.pendingDeviceCodes.indexOf(deviceCode);
	if (index === -1) return undefined;
	state.pendingDeviceCodes.splice(index, 1);
	const device: StoredDevice = {
		id: state.nextId++,
		displayType: 'None',
		matchNo: null,
		// Kein echter Referenz-Endpunkt verifizierbar (`GET /Display/register` liefert auf dem
		// Live-Server aktuell `500 NotImplementedException`, Stand 2026-09-04) — Default
		// mangels Vorgabe auf `Dark` gesetzt, wie bisher schon App-weiter Default.
		displayTheme: 'Dark',
		deviceCode
	};
	(state.devices[veranstaltungId] ??= []).push(device);
	persist(state);
	return toPublicDevice(device);
}

export function updateDevice(
	veranstaltungId: string,
	deviceId: number,
	data: UpdateDeviceData
): Device | undefined {
	const state = load();
	const device = (state.devices[veranstaltungId] ?? []).find((d) => d.id === deviceId);
	if (!device) return undefined;
	Object.assign(device, data);
	persist(state);
	return toPublicDevice(device);
}

export interface AssignedDeviceLookup {
	veranstaltungId: string;
	device: Device;
}

/**
 * Löst den `deviceCode` eines registrierten Geräts auf seine Fixture-Zuordnung auf — treibt
 * `GET /Display/data`. `undefined` heißt: registriert, aber noch keiner Fixture zugeordnet
 * (Antwort dann `displayType: 'Unassigned'`, siehe `displays.ts`).
 */
export function findAssignedDeviceByCode(deviceCode: string): AssignedDeviceLookup | undefined {
	const state = load();
	for (const [veranstaltungId, list] of Object.entries(state.devices)) {
		const device = list.find((d) => d.deviceCode === deviceCode);
		if (device) return { veranstaltungId, device: toPublicDevice(device) };
	}
	return undefined;
}

/** Begegnungen des Matches mit dieser `nummer` (= `matchNo`), unabhängig davon, ob es gerade
 * die freigegebene Runde ist — genutzt von `GET /Display/data`, um zu wissen, WELCHE Scheiben
 * das einem Match zugeordnete Gerät zeigen soll. */
export function begegnungenForMatch(veranstaltungId: string, matchNo: number): Begegnung[] {
	const match = load().matches.find(
		(m) => m.veranstaltung_id === veranstaltungId && m.nummer === matchNo
	);
	return match?.begegnungen ?? [];
}

/**
 * Entspricht `GET /fixtures/{fixtureId}/rounds/{roundNo}` (Fawkes-`DosController`, Issue #22) —
 * `undefined` = Runde existiert nicht. Liefert die flache Scheiben-Liste, wie es die echte API
 * auch tut (keine Begegnungs-Paarung, die macht der Client, siehe `matchkontrolle.ts`).
 *
 * Satzpunkte kommen über `berechneMatchStand` (`shared-state.ts`) — bislang nur von
 * Binocular/Display genutzt, weil das Admin-Modell hier bewusst von laufenden Scoring-Daten
 * getrennt war. Diese Trennung war zu streng für ein Feature, das laut echtem Kontrakt keins
 * ist: der reale Fawkes-Server berechnet Satzpunkte für `GetRoundResponse` ebenso serverseitig,
 * der Client bekommt nur das fertige Ergebnis. Kein zirkulärer Import: `shared-state.ts`
 * importiert selbst nichts aus dieser Datei.
 */
export function getRoundInfo(veranstaltungId: string, roundNo: number): RoundTarget[] | undefined {
	const begegnungen = begegnungenForMatch(veranstaltungId, roundNo);
	if (begegnungen.length === 0) return undefined;

	const targets: RoundTarget[] = [];
	for (const b of begegnungen) {
		const stand = berechneMatchStand(b.scheibe_a, b.scheibe_b);
		targets.push({
			targetNo: b.scheibe_a,
			teamName: b.mannschaft_a,
			totalSetPoints: stand.satzpunkteA,
			setScores: stand.ergebnisse.map((e) => e.ringeA)
		});
		targets.push({
			targetNo: b.scheibe_b,
			teamName: b.mannschaft_b,
			totalSetPoints: stand.satzpunkteB,
			setScores: stand.ergebnisse.map((e) => e.ringeB)
		});
	}
	return targets;
}

/** Entspricht `PUT /fixtures/{fixtureId}/devices/{deviceId}/unassign`. */
export function unassignDevice(veranstaltungId: string, deviceId: number): boolean {
	const state = load();
	const list = state.devices[veranstaltungId];
	if (!list) return false;
	const index = list.findIndex((d) => d.id === deviceId);
	if (index === -1) return false;
	list.splice(index, 1);
	persist(state);
	return true;
}

// ── Lookups für Display (#1–#3) und Binocular (#4–#5) — siehe Issue #10 ─────────────────

export interface AktivesMatchFuerScheibe {
	match: Match;
	begegnung: Begegnung;
	/** 'a' wenn scheibennummer === begegnung.scheibe_a, sonst 'b'. */
	seite: 'a' | 'b';
}

export function findAktivesMatchFuerScheibe(
	scheibennummer: number
): AktivesMatchFuerScheibe | undefined {
	const state = load();
	for (const m of state.matches) {
		if (state.currentRoundNo[m.veranstaltung_id] !== m.nummer) continue;
		for (const begegnung of m.begegnungen) {
			if (begegnung.scheibe_a === scheibennummer)
				return { match: toMatch(state, m), begegnung, seite: 'a' };
			if (begegnung.scheibe_b === scheibennummer)
				return { match: toMatch(state, m), begegnung, seite: 'b' };
		}
	}
	return undefined;
}

export function mannschaftUndGegner(
	begegnung: Begegnung,
	seite: 'a' | 'b'
): { mannschaft: string; gegner: string } {
	return seite === 'a'
		? { mannschaft: begegnung.mannschaft_a, gegner: begegnung.mannschaft_b }
		: { mannschaft: begegnung.mannschaft_b, gegner: begegnung.mannschaft_a };
}
