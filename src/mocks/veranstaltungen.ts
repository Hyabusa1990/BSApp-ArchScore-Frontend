import type { User } from '$lib/api/auth';
import type { Veranstaltung, FixtureUser } from '$lib/api/veranstaltung';
import type { Match, Begegnung } from '$lib/api/matchkontrolle';
import type { Bildschirm } from '$lib/api/bildschirme';
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
 */

const OWNER_USER = users.member.id;
const OWNER_ADMIN = users.admin.id;

interface TabletPairingRecord {
	token: string;
	veranstaltungId: string;
	scheibennummer: number;
}

/** Intern gespeicherte Match-Daten ohne `aktiv` — das Freigabe-Flag ist seit #10 rein aus
 * `currentRoundNo` (Fawkes-`roundNo`) abgeleitet, nicht mehr selbst persistiert. */
type StoredMatch = Omit<Match, 'aktiv'>;

interface State {
	veranstaltungen: Veranstaltung[];
	matches: StoredMatch[];
	bildschirme: Bildschirm[];
	tabletPairings: TabletPairingRecord[];
	/** Veranstaltungs-ID -> aktuell freigegebene Runde (Fawkes-`roundNo`, siehe Issue #10). */
	currentRoundNo: Record<string, number>;
	/** Veranstaltungs-ID -> Fixture-Mitglieder (Fawkes `GetUserResponse[]`, siehe Issue #13). */
	fixtureUsers: Record<string, FixtureUser[]>;
	nextId: number;
}

function toMatch(state: State, m: StoredMatch): Match {
	return { ...m, aktiv: state.currentRoundNo[m.veranstaltung_id] === m.nummer };
}

function seedState(): State {
	return {
		veranstaltungen: [
			{
				id: 'v-1',
				owner_id: OWNER_ADMIN,
				name: '1. WKT Bundesliga',
				fixtureId: 1001,
				fixtureUniqueId: 'f1e57000-0000-4000-8000-000000000001',
				datenquelle: 'tabelle',
				tabelle: [
					{ platz: 1, mannschaft_name: 'BSC Abendau', satzpunkte: 15, matchpunkte: 14 },
					{ platz: 2, mannschaft_name: 'SV Scharfhaus', satzpunkte: 7, matchpunkte: 11 },
					{ platz: 3, mannschaft_name: 'SGes Schützenschaft', satzpunkte: -5, matchpunkte: 11 },
					{ platz: 4, mannschaft_name: 'BS Hunshausen', satzpunkte: 12, matchpunkte: 6 },
					{ platz: 5, mannschaft_name: 'SV Vogelwiese', satzpunkte: 8, matchpunkte: 8 },
					{ platz: 6, mannschaft_name: 'BS Weiß-Blau München', satzpunkte: -10, matchpunkte: 2 },
					{ platz: 7, mannschaft_name: 'SGi Wuppenhausen', satzpunkte: -22, matchpunkte: 2 },
					{ platz: 8, mannschaft_name: 'BSC Rot-Rot Beerendorf', satzpunkte: -15, matchpunkte: 0 }
				]
			},
			{
				id: 'v-2',
				owner_id: OWNER_USER,
				name: 'Kreisliga Ost',
				fixtureId: 1002,
				fixtureUniqueId: 'f1e57000-0000-4000-8000-000000000002',
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
				veranstaltung_id: 'v-1',
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
				veranstaltung_id: 'v-1',
				nummer: 2,
				begegnungen: [
					{ scheibe_a: 1, scheibe_b: 2, mannschaft_a: 'SV Vogelwiese', mannschaft_b: 'BSC Abendau' }
				]
			},
			{
				id: 'm-3',
				veranstaltung_id: 'v-1',
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
				veranstaltung_id: 'v-1',
				scheibe_a: 1,
				scheibe_b: 2,
				name: null,
				pin: 'A1L35P',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-2',
				veranstaltung_id: 'v-1',
				scheibe_a: 3,
				scheibe_b: 4,
				name: null,
				pin: 'P94T67',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-3',
				veranstaltung_id: 'v-1',
				scheibe_a: 5,
				scheibe_b: 6,
				name: null,
				pin: 'KLM579',
				aktiv: true,
				mode: 'ergebnisse'
			},
			{
				id: 'b-4',
				veranstaltung_id: 'v-1',
				scheibe_a: 7,
				scheibe_b: 8,
				name: null,
				pin: 'T52LAB',
				aktiv: false,
				mode: 'ergebnisse'
			},
			{
				id: 'b-5',
				veranstaltung_id: 'v-1',
				scheibe_a: null,
				scheibe_b: null,
				name: 'BEAMER',
				pin: 'RTZ794',
				aktiv: true,
				mode: 'tabelle'
			}
		],
		tabletPairings: [],
		currentRoundNo: { 'v-1': 1 },
		fixtureUsers: {
			'v-1': [{ userName: users.admin.email, isOwner: true }],
			'v-2': [{ userName: users.member.email, isOwner: true }]
		},
		nextId: 100
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

function generatePin(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function canSee(user: User, v: Veranstaltung): boolean {
	return user.role === 'admin' || v.owner_id === user.id;
}

export function visibleVeranstaltungen(user: User): Veranstaltung[] {
	return load().veranstaltungen.filter((v) => canSee(user, v));
}

export function findVeranstaltung(user: User, id: string): Veranstaltung | undefined {
	const v = load().veranstaltungen.find((v) => v.id === id);
	return v && canSee(user, v) ? v : undefined;
}

/** Bearer-authentifizierter Lookup für den Fawkes-Phase-Endpunkt (`fixtureId` numerisch statt
 * Veranstaltungs-UUID) — Ownership-Check identisch zu `findVeranstaltung` (siehe Issue #10). */
export function findVeranstaltungByFixtureId(
	user: User,
	fixtureId: number
): Veranstaltung | undefined {
	const v = load().veranstaltungen.find((v) => v.fixtureId === fixtureId);
	return v && canSee(user, v) ? v : undefined;
}

/** Ungefiltert wie `findBildschirmByPin`/`findTabletPairing` weiter unten — der echte
 * Spotter-Info-Endpunkt ist laut Fawkes-Spec Bearer-frei, die schwer zu erratende
 * `fixtureUniqueId` selbst ist die Absicherung (siehe binocular.ts). Jetzt auch von der
 * Matchkontrolle direkt genutzt, um den Confirm-Status pro Scheibe zu lesen (Issue #10). */
export function findVeranstaltungByFixtureUniqueId(
	fixtureUniqueId: string
): Veranstaltung | undefined {
	return load().veranstaltungen.find((v) => v.fixtureUniqueId === fixtureUniqueId);
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

export function createVeranstaltung(user: User, name: string): Veranstaltung {
	const state = load();
	const v: Veranstaltung = {
		id: generateId(state, 'v'),
		owner_id: user.id,
		name,
		// Mock-Annahme 1 Veranstaltung = 1 Fixture (siehe Issue #10) — fixtureId hier einfach
		// hochgezählt, echte Fawkes-Fixture-Anlage ist Backend-Sache.
		fixtureId: state.nextId,
		fixtureUniqueId: crypto.randomUUID(),
		datenquelle: null
	};
	state.veranstaltungen.push(v);
	// Ersteller wird automatisch Owner (Rücksprache Backend-Entwickler 2026-08-17, Issue #13).
	state.fixtureUsers[v.id] = [{ userName: user.email, isOwner: true }];
	persist(state);
	return v;
}

export function removeVeranstaltung(user: User, id: string): boolean {
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
function ensureDemoMatch(state: State, v: Veranstaltung) {
	if (state.matches.some((m) => m.veranstaltung_id === v.id)) return;
	const namen = (v.tabelle ?? []).map((e) => e.mannschaft_name);
	state.matches.push({
		id: generateId(state, 'm'),
		veranstaltung_id: v.id,
		nummer: 1,
		begegnungen: [
			{
				scheibe_a: 1,
				scheibe_b: 2,
				mannschaft_a: namen[0] ?? 'Mannschaft A',
				mannschaft_b: namen[1] ?? 'Mannschaft B'
			}
		]
	});
	state.currentRoundNo[v.id] = 1;
}

function findInState(state: State, id: string): Veranstaltung | undefined {
	return state.veranstaltungen.find((v) => v.id === id);
}

export function setTabelle(v: Veranstaltung, eintraege: Veranstaltung['tabelle']): Veranstaltung {
	const state = load();
	const target = findInState(state, v.id) ?? v;
	target.datenquelle = 'tabelle';
	target.tabelle = eintraege;
	target.liga = undefined;
	ensureDemoMatch(state, target);
	persist(state);
	return target;
}

export function clearTabelle(v: Veranstaltung): Veranstaltung {
	const state = load();
	const target = findInState(state, v.id) ?? v;
	target.datenquelle = null;
	target.tabelle = undefined;
	state.matches = state.matches.filter((m) => m.veranstaltung_id !== target.id);
	persist(state);
	return target;
}

export function connectLiga(
	v: Veranstaltung,
	liga: NonNullable<Veranstaltung['liga']>
): Veranstaltung {
	const state = load();
	const target = findInState(state, v.id) ?? v;
	target.datenquelle = 'liga';
	target.liga = liga;
	target.tabelle = undefined;
	ensureDemoMatch(state, target);
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

export function bildschirmeFor(veranstaltungId: string): Bildschirm[] {
	return load().bildschirme.filter((b) => b.veranstaltung_id === veranstaltungId);
}

export function updateBildschirm(
	veranstaltungId: string,
	bildschirmId: string,
	data: Partial<Pick<Bildschirm, 'pin' | 'aktiv' | 'mode'>>
): Bildschirm | undefined {
	const state = load();
	const b = state.bildschirme.find(
		(b) => b.id === bildschirmId && b.veranstaltung_id === veranstaltungId
	);
	if (!b) return undefined;
	Object.assign(b, data);
	persist(state);
	return b;
}

export function createBildschirm(veranstaltungId: string, name: string): Bildschirm {
	const state = load();
	const b: Bildschirm = {
		id: generateId(state, 'b'),
		veranstaltung_id: veranstaltungId,
		scheibe_a: null,
		scheibe_b: null,
		name,
		pin: generatePin(),
		aktiv: true,
		mode: 'tabelle'
	};
	state.bildschirme.push(b);
	persist(state);
	return b;
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
export function findBildschirmByPin(pin: string): Bildschirm | undefined {
	const normalized = pin.trim().toUpperCase();
	return load().bildschirme.find((b) => b.pin.trim().toUpperCase() === normalized);
}

/** Ungefiltert — wird nur für öffentlich lesbare Anzeige-Inhalte (Display-Tabellenmodus)
 * gebraucht, nicht für Admin-Zugriff (der läuft über findVeranstaltung mit Ownership-Check). */
export function getVeranstaltungById(id: string): Veranstaltung | undefined {
	return load().veranstaltungen.find((v) => v.id === id);
}
