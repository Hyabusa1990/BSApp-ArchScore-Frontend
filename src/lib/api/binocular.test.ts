import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { binocularApi } from './binocular';
import { deriveMonitorStatus, displayApi, type DisplaySeite } from './display';

/**
 * Regression: Fawkes füllt `shots` beim Lesen mit Leerzeichen auf Satzlänge auf ("+     ").
 * Früher hängte `postPfeil` den nächsten Pfeil dahinter ("+     0"), Fawkes schnitt ihn ab und
 * die Leerzeichen wurden als "M" angezeigt — es ließ sich nur ein Pfeil erfassen.
 *
 * Fake-Fawkes: merkt sich den zuletzt per PUT gesetzten Stand (auf 6 Zeichen gekürzt) und gibt
 * ihn beim Lesen wie die echte API auf 6 Zeichen aufgefüllt zurück.
 */
const originalFetch = globalThis.fetch;
let stored = '';
let puts: string[] = [];

function padded(shots: string) {
	return shots ? shots.padEnd(6, ' ') : shots;
}

beforeEach(() => {
	stored = '';
	puts = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? 'GET';
		const body = (shots: string) =>
			JSON.stringify({
				targetNo: 1,
				teamName: 'A',
				currentSetNo: 1,
				currentSetScore: null,
				isConfirmed: false,
				shots
			});
		if (url.endsWith('/spotter/shots') && method === 'PUT') {
			const sent = JSON.parse(String(init?.body)).shots as string;
			puts.push(sent);
			stored = sent.slice(0, 6).trimEnd();
			return new Response(body(stored));
		}
		if (url.endsWith('/spotter/info')) return new Response(body(padded(stored)));
		if (url.endsWith('/displays/data')) {
			return new Response(
				JSON.stringify({
					displayType: 'Match',
					displayTheme: 'Light',
					targets: [{ targetNo: 1, teamName: 'A', shots: padded(stored), setScores: null }],
					leagueTablePositions: null,
					deviceCode: '1'
				})
			);
		}
		return new Response('', { status: 404 });
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

test('mehrere Pfeile nacheinander werden erfasst (kein Anhängen hinter Füllzeichen)', async () => {
	await binocularApi.postPfeil('guid', 1, 10);
	await binocularApi.postPfeil('guid', 1, 0);
	await binocularApi.postPfeil('guid', 1, 8);
	const last = await binocularApi.postPfeil('guid', 1, 9);

	assert.deepEqual(puts, ['+', '+0', '+08', '+089']);
	assert.equal(last.shots, '+089');
});

test('getScheibe liefert shots ohne Füllzeichen', async () => {
	await binocularApi.postPfeil('guid', 1, 10);
	const info = await binocularApi.getScheibe('guid', 1);
	assert.equal(info.shots, '+');
});

test('Undo entfernt den letzten Pfeil, nicht ein Füllzeichen', async () => {
	await binocularApi.postPfeil('guid', 1, 10);
	await binocularApi.postPfeil('guid', 1, 7);
	const after = await binocularApi.postUndo('guid', 1);
	assert.equal(puts.at(-1), '+');
	assert.equal(after.shots, '+');
});

test('Anzeige: aufgefüllter leerer Satz gilt nicht als laufend, Füllzeichen sind keine Pfeile', async () => {
	stored = '+';
	const data = await displayApi.getData('token');
	assert.equal(data.targets[0].shots, '+');

	stored = '';
	const empty = await displayApi.getData('token');
	assert.equal(deriveMonitorStatus(empty.targets[0] as DisplaySeite), 'VOR_DEM_MATCH');
});
