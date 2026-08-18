import type { User } from '$lib/api/auth';
import type {
	Veranstaltung,
	CreateFixtureData,
	FixtureUser,
	MatchPlayChart,
	MatchPlayChartTeam
} from '$lib/api/veranstaltung';
import type { Match, Begegnung } from '$lib/api/matchkontrolle';
import type { Device, UpdateDeviceData } from '$lib/api/bildschirme';
import { users } from './fixtures';
import { loadState, saveState } from './persist';

/**
 * Fake-Backend-Zustand für die Verwaltungsoberfläche — ein gemeinsamer Store für
 * Veranstaltung/Match/Bildschirm (referenzieren sich gegenseitig über veranstaltung_id).
 * Weiterhin eigenständig ggü. db.ts (auth-spezifisch), aber jetzt die Quelle, aus der
 * displays.ts/binoculars.ts ihren Zustand lesen (welches Match ist aktiv, welcher
 * Bildschirm/Tablet-Token gehört wozu) — siehe Issue #10.
 *
 * Über `localStorage` persistiert (siehe persist.ts): Admin-Verwaltung, Display und
 * Spotter-Tablet laufen in der Realität auf verschiedenen Geräten, im Dev-Setup simuliert
 * durch verschiedene Browser-Tabs — reine Modul-Variablen wären dafür NICHT konsistent,
 * jeder Tab hat seinen eigenen JS-Kontext. Jede Funktion liest den Zustand deshalb frisch
 * und schreibt ihn nach jeder Änderung zurück, statt ihn einmalig beim Modul-Load zu laden.
 *
 * `Veranstaltung.id` ist seit Issue #14 die echte numerische Fawkes-Fixture-ID — alle anderen
 * hier gespeicherten Records (Match/Bildschirm/TabletPairing/currentRoundNo/fixtureUsers/
 * matchPlayCharts) referenzieren sie weiterhin über einen STRING-Schlüssel (`String(v.id)`),
 * das sind rein interne Mock-Konzepte ohne echtes Fawkes-Pendant, ihr Schlüsseltyp ist bewusst
 * unverändert geblieben (kleinerer Diff, kein Fawkes-Kontrakt zu verletzen).
 */

interface TabletPairingRecord {
	token: string;
	veranstaltungId: string;
	scheibennummer: number;
}

/**
 * Bewusst NICHT mehr `$lib/api/bildschirme` (das Modul modelliert seit Issue #15 nur noch das
 * echte Device-CRUD, `pin`/`scheibe_a`/`scheibe_b`/`mode`/`aktiv` existieren dort nicht mehr).
 * Dieser Typ treibt ausschließlich die weiterhin unangetastete, JWT+PIN-basierte
 * Display-Konsum-Seite (`displays.ts`/`handlers/display.ts`) — bewusste Nahtstelle, siehe #15.
 */
interface LegacyBildschirm {
	id: string;
	veranstaltung_id: string;
	scheibe_a: number | null;
	scheibe_b: number | null;
	name: string | null;
	pin: string;
	aktiv: boolean;
	mode: 'ergebnisse' | 'tabelle';
}

/** Intern gespeicherte Match-Daten ohne `aktiv` — das Freigabe-Flag ist seit #10 rein aus
 * `currentRoundNo` (Fawkes-`roundNo`) abgeleitet, nicht mehr selbst persistiert. */
type StoredMatch = Omit<Match, 'aktiv'>;

interface State {
	veranstaltungen: Veranstaltung[];
	matches: StoredMatch[];
	bildschirme: LegacyBildschirm[];
	tabletPairings: TabletPairingRecord[];
	/** Veranstaltungs-ID (String) -> aktuell freigegebene Runde (Fawkes-`roundNo`, Issue #10). */
	currentRoundNo: Record<string, number>;
	/** Veranstaltungs-ID (String) -> Fixture-Mitglieder (Fawkes `GetUserResponse[]`, Issue #13). */
	fixtureUsers: Record<string, FixtureUser[]>;
	/** Veranstaltungs-ID (String) -> initiale Tabelle (`GetMatchPlayChartResponse`, Issue #14). */
	matchPlayCharts: Record<string, MatchPlayChart>;
	/** Veranstaltungs-ID (String) -> zugewiesene Geräte (Fawkes `GetDeviceResponse[]`, Issue #15). */
	devices: Record<string, Device[]>;
	/** deviceCodes, die sich schon "selbst registriert" haben, aber noch keiner Fixture
	 * zugeordnet sind (simuliert `/Display/register`, hier NICHT nachgebaut — nur ein Pool zum
	 * Testen von `assign`, siehe Issue #15). */
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
		matches: [
			{
				id: 'm-1',
				veranstaltung_id: '1001',
				nummer: 1,
				begegnungen: [
					{
						scheibe_a: 1,
						scheibe_b: 2,
						mannschaft_a: 'BSC Abendau',
						mannschaft_b: 'SV Scharfhaus'
					},
					{
						scheibe_a: 3,
						scheibe_b: 4,
						mannschaft_a: 'SGes Schützenschaft',
						mannschaft_b: 'BS Hunshausen'
					}
				]
			},
			{
				id: 'm-2',
				veranstaltung_id: '1001',
				nummer: 2,
				begegnungen: [
					{ scheibe_a: 1, scheibe_b: 2, mannschaft_a: 'SV Vogelwiese', mannschaft_b: 'BSC Abendau' }
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
						mannschaft_a: 'BS Weiß-Blau München',
						mannschaft_b: 'SGi Wuppenhausen'
					}
				]
			}
		],
		bildschirme: [
			{
				id: 'b-1',
				veranstaltung_id: '1001',
				scheibe_a: 1,
				scheibe_b: 2,
				name: null,
				pin: 'A1L35P',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-2',
				veranstaltung_id: '1001',
				scheibe_a: 3,
				scheibe_b: 4,
				name: null,
				pin: 'P94T67',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-3',
				veranstaltung_id: '1001',
				scheibe_a: 5,
				scheibe_b: 6,
				name: null,
				pin: 'KLM579',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-4',
				veranstaltung_id: '1001',
				scheibe_a: 7,
				scheibe_b: 8,
				name: null,
				pin: 'T52LAB',
				aktiv: false,
				mode: 'ergebnisse'
			},
			{
				id: 'b-5',
				veranstaltung_id: '1001',
				scheibe_a: null,
				scheibe_b: null,
				name: 'BEAMER',
				pin: 'RTZ794',
				aktiv: true,
				mode: 'tabelle'
			}
		],
		tabletPairings: [],
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
			'1001': [{ id: 500, displayType: 'Match', matchNo: 1 }]
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

/** Ungefiltert wie `findBildschirmByPin`/`findTabletPairing` weiter unten — der echte
 * Spotter-Info-Endpunkt ist laut Fawkes-Spec Bearer-frei, die schwer zu erratende `uniqueId`
 * selbst ist die Absicherung (siehe binocular.ts). Von der Matchkontrolle genutzt, um den
 * Confirm-Status pro Scheibe zu lesen (Issue #10). */
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
 * Entspricht `POST /MatchPlayChart/{fixtureId}` ohne `hardOverride` (Issue #14): schlägt fehl,
 * wenn für diese Fixture schon eine Tabelle existiert — kein Reset-/Lösch-Pfad hier, weil dafür
 * kein echter Endpunkt verifiziert ist (siehe `veranstaltung.ts`). `undefined` = Konflikt.
 */
export function createMatchPlayChart(
	v: Veranstaltung,
	teams: MatchPlayChartTeam[]
): MatchPlayChart | undefined {
	const state = load();
	const id = String(v.id);
	if (state.matchPlayCharts[id]) return undefined;

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

// ── Geräteverwaltung (Fawkes `DeviceManagementController`, siehe Issue #15) ────────────────

export function devicesFor(veranstaltungId: string): Device[] {
	return load().devices[veranstaltungId] ?? [];
}

export function findDevice(veranstaltungId: string, deviceId: number): Device | undefined {
	return devicesFor(veranstaltungId).find((d) => d.id === deviceId);
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
	const device: Device = { id: state.nextId++, displayType: 'None', matchNo: null };
	(state.devices[veranstaltungId] ??= []).push(device);
	persist(state);
	return device;
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
	return device;
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

// Anders als vorher (#9, zustandslos erzeugt) merkt sich das jetzt ausgestellte Tokens —
// erst dadurch kann der Binocular-Mock (#4) sie überhaupt validieren, siehe Issue #10.
export function generateTabletToken(
	veranstaltungId: string,
	scheibennummer: number
): { scheibennummer: number; token: string } {
	const state = load();
	const token = `tablet-${crypto.randomUUID()}`;
	state.tabletPairings.push({ token, veranstaltungId, scheibennummer });
	persist(state);
	return { scheibennummer, token };
}

export function findTabletPairing(token: string): TabletPairingRecord | undefined {
	return load().tabletPairings.find((p) => p.token === token);
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

/**
 * Ungefiltert (kein Ownership-Check) — Display-Pairing per PIN ist kein Account-Auth-Vorgang.
 * PIN-Vergleich bewusst tolerant (getrimmt, groß/klein ignoriert): der Admin tippt den am
 * Display angezeigten Code von Hand ab, Tippfehler bei Groß-/Kleinschreibung sollen das
 * Pairing nicht unnötig verhindern.
 */
export function findBildschirmByPin(pin: string): LegacyBildschirm | undefined {
	const normalized = pin.trim().toUpperCase();
	return load().bildschirme.find((b) => b.pin.trim().toUpperCase() === normalized);
}

/** Ungefiltert — wird nur für öffentlich lesbare Anzeige-Inhalte (Display-Tabellenmodus)
 * gebraucht, nicht für Admin-Zugriff (der läuft über findVeranstaltung mit Ownership-Check).
 * `id` ist der String-Schlüssel, wie ihn Bildschirm/Match auch verwenden — vergleicht daher
 * gegen `String(v.id)`, nicht gegen die numerische Fixture-ID direkt. */
export function getVeranstaltungById(id: string): Veranstaltung | undefined {
	return load().veranstaltungen.find((v) => String(v.id) === id);
}
