import type { User } from '$lib/api/auth';
import type { Veranstaltung } from '$lib/api/veranstaltung';
import type { Match } from '$lib/api/matchkontrolle';
import type { Bildschirm } from '$lib/api/bildschirme';
import { users } from './fixtures';

/**
 * In-memory Fake-Backend-Zustand für die Verwaltungsoberfläche — ein gemeinsamer Store für
 * Veranstaltung/Match/Bildschirm (referenzieren sich gegenseitig über veranstaltung_id).
 * Eigenständig, nicht geteilt mit db.ts/displays.ts/binoculars.ts (siehe Issue #10 für die
 * geplante spätere Zusammenführung — hier bewusst noch nicht).
 */

const OWNER_USER = users.member.id;
const OWNER_ADMIN = users.admin.id;

export const veranstaltungen: Veranstaltung[] = [
	{
		id: 'v-1',
		owner_id: OWNER_ADMIN,
		name: '1. WKT Bundesliga',
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
		datenquelle: 'liga',
		liga: {
			liga_app: 'BSApp Liga',
			url: 'https://liga.bsapp.de',
			login_pin: 'A689HL5',
			digitaler_schusszettel: true
		}
	}
];

export const matches: Match[] = [
	{
		id: 'm-1',
		veranstaltung_id: 'v-1',
		nummer: 1,
		aktiv: true,
		begegnungen: [
			{ scheibe_a: 1, scheibe_b: 2, mannschaft_a: 'BSC Abendau', mannschaft_b: 'SV Scharfhaus' },
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
		aktiv: false,
		begegnungen: [
			{ scheibe_a: 1, scheibe_b: 2, mannschaft_a: 'SV Vogelwiese', mannschaft_b: 'BSC Abendau' }
		]
	},
	{
		id: 'm-3',
		veranstaltung_id: 'v-1',
		nummer: 3,
		aktiv: false,
		begegnungen: [
			{
				scheibe_a: 1,
				scheibe_b: 2,
				mannschaft_a: 'BS Weiß-Blau München',
				mannschaft_b: 'SGi Wuppenhausen'
			}
		]
	}
];

export const bildschirme: Bildschirm[] = [
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
];

let nextId = 100;
function generateId(prefix: string): string {
	return `${prefix}-${nextId++}`;
}

export function canSee(user: User, v: Veranstaltung): boolean {
	return user.role === 'admin' || v.owner_id === user.id;
}

export function visibleVeranstaltungen(user: User): Veranstaltung[] {
	return veranstaltungen.filter((v) => canSee(user, v));
}

export function findVeranstaltung(user: User, id: string): Veranstaltung | undefined {
	const v = veranstaltungen.find((v) => v.id === id);
	return v && canSee(user, v) ? v : undefined;
}

export function createVeranstaltung(user: User, name: string): Veranstaltung {
	const v: Veranstaltung = { id: generateId('v'), owner_id: user.id, name, datenquelle: null };
	veranstaltungen.push(v);
	return v;
}

export function removeVeranstaltung(user: User, id: string): boolean {
	const v = findVeranstaltung(user, id);
	if (!v) return false;
	const idx = veranstaltungen.indexOf(v);
	veranstaltungen.splice(idx, 1);
	return true;
}

// Reine Mock-Vereinfachung: erzeugt EINEN Demo-Match statt eines echten Spielplans —
// die tatsächliche Berechnung (Round-Robin etc.) ist Backend-Sache, siehe FACHLICHKEIT.md
// "Diese App berechnet keine eigenen Ergebnisse". Ziel hier ist nur, dass #7/#8 danach
// etwas zum Anzeigen haben.
function ensureDemoMatch(v: Veranstaltung) {
	if (matches.some((m) => m.veranstaltung_id === v.id)) return;
	const namen = (v.tabelle ?? []).map((e) => e.mannschaft_name);
	matches.push({
		id: generateId('m'),
		veranstaltung_id: v.id,
		nummer: 1,
		aktiv: true,
		begegnungen: [
			{
				scheibe_a: 1,
				scheibe_b: 2,
				mannschaft_a: namen[0] ?? 'Mannschaft A',
				mannschaft_b: namen[1] ?? 'Mannschaft B'
			}
		]
	});
}

export function setTabelle(v: Veranstaltung, eintraege: Veranstaltung['tabelle']): Veranstaltung {
	v.datenquelle = 'tabelle';
	v.tabelle = eintraege;
	v.liga = undefined;
	ensureDemoMatch(v);
	return v;
}

export function clearTabelle(v: Veranstaltung): Veranstaltung {
	v.datenquelle = null;
	v.tabelle = undefined;
	for (const m of [...matches]) {
		if (m.veranstaltung_id === v.id) matches.splice(matches.indexOf(m), 1);
	}
	return v;
}

export function connectLiga(
	v: Veranstaltung,
	liga: NonNullable<Veranstaltung['liga']>
): Veranstaltung {
	v.datenquelle = 'liga';
	v.liga = liga;
	v.tabelle = undefined;
	ensureDemoMatch(v);
	return v;
}

export function matchesFor(veranstaltungId: string): Match[] {
	return matches.filter((m) => m.veranstaltung_id === veranstaltungId);
}

/** Aktiviert das gewählte Match, deaktiviert automatisch jedes andere derselben Veranstaltung. */
export function activateMatch(veranstaltungId: string, matchId: string): Match[] | undefined {
	const target = matches.find((m) => m.id === matchId && m.veranstaltung_id === veranstaltungId);
	if (!target) return undefined;
	for (const m of matches) {
		if (m.veranstaltung_id === veranstaltungId) m.aktiv = m.id === matchId;
	}
	return matchesFor(veranstaltungId);
}

/** Deaktiviert das gewählte Match, ohne ein anderes zu aktivieren. */
export function deactivateMatch(veranstaltungId: string, matchId: string): Match[] | undefined {
	const target = matches.find((m) => m.id === matchId && m.veranstaltung_id === veranstaltungId);
	if (!target) return undefined;
	target.aktiv = false;
	return matchesFor(veranstaltungId);
}

export function bildschirmeFor(veranstaltungId: string): Bildschirm[] {
	return bildschirme.filter((b) => b.veranstaltung_id === veranstaltungId);
}

export function updateBildschirm(
	veranstaltungId: string,
	bildschirmId: string,
	data: Partial<Pick<Bildschirm, 'pin' | 'aktiv' | 'mode'>>
): Bildschirm | undefined {
	const b = bildschirme.find(
		(b) => b.id === bildschirmId && b.veranstaltung_id === veranstaltungId
	);
	if (!b) return undefined;
	Object.assign(b, data);
	return b;
}

export function createBildschirm(veranstaltungId: string, name: string): Bildschirm {
	const b: Bildschirm = {
		id: generateId('b'),
		veranstaltung_id: veranstaltungId,
		scheibe_a: null,
		scheibe_b: null,
		name,
		pin: generatePin(),
		aktiv: true,
		mode: 'tabelle'
	};
	bildschirme.push(b);
	return b;
}

function generatePin(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateTabletToken(scheibennummer: number): {
	scheibennummer: number;
	token: string;
} {
	return { scheibennummer, token: `tablet-${crypto.randomUUID()}` };
}
