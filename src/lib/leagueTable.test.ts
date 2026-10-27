import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LeagueTablePosition } from '$lib/api/display';
import { orderLeagueTable } from './leagueTable';

const pos = (teamName: string, rank: number): LeagueTablePosition => ({
	rank,
	rankDifference: 0,
	teamName,
	setPointsWon: 0,
	setPointsLost: 0,
	matchPointsWon: 0,
	matchPointsLost: 0
});
const names = (r: LeagueTablePosition[]) => r.map((e) => e.teamName);

test('eindeutige Ränge: nach Rang sortiert', () => {
	const { rows, ranked } = orderLeagueTable([pos('B', 2), pos('A', 1), pos('C', 3)]);
	assert.equal(ranked, true);
	assert.deepEqual(names(rows), ['A', 'B', 'C']);
});

test('alle Ränge 0: API-Reihenfolge, kein Rang', () => {
	const { rows, ranked } = orderLeagueTable([pos('B', 0), pos('A', 0), pos('C', 0)]);
	assert.equal(ranked, false);
	assert.deepEqual(names(rows), ['B', 'A', 'C']);
});

test('doppelter Rang: API-Reihenfolge, kein Rang', () => {
	const { rows, ranked } = orderLeagueTable([pos('C', 3), pos('A', 1), pos('B', 1)]);
	assert.equal(ranked, false);
	assert.deepEqual(names(rows), ['C', 'A', 'B']);
});

test('leere Liste', () => {
	assert.deepEqual(orderLeagueTable([]), { rows: [], ranked: true });
});
