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

test('alle Ränge gleich 1 (initial): API-Reihenfolge, aufsteigende Plätze, kein Trend', () => {
	const { rows, ranked } = orderLeagueTable([pos('B', 1), pos('A', 1), pos('C', 1)]);
	assert.equal(ranked, false);
	assert.deepEqual(names(rows), ['B', 'A', 'C']);
	assert.deepEqual(
		rows.map((r) => r.position),
		[1, 2, 3]
	);
});

test('alle Ränge 0: wie initial', () => {
	const { rows, ranked } = orderLeagueTable([pos('B', 0), pos('A', 0)]);
	assert.equal(ranked, false);
	assert.deepEqual(names(rows), ['B', 'A']);
	assert.deepEqual(
		rows.map((r) => r.position),
		[1, 2]
	);
});

test('teilweise Gleichstand: Backend-Rang bleibt, nach Rang sortiert', () => {
	const { rows, ranked } = orderLeagueTable([pos('C', 3), pos('A', 1), pos('B', 1)]);
	assert.equal(ranked, true);
	assert.deepEqual(names(rows), ['A', 'B', 'C']);
	assert.deepEqual(
		rows.map((r) => r.position),
		[1, 1, 3]
	);
});

test('einzelne Mannschaft: Rang angezeigt', () => {
	const { rows, ranked } = orderLeagueTable([pos('A', 1)]);
	assert.equal(ranked, true);
	assert.equal(rows[0].position, 1);
});

test('leere Liste', () => {
	assert.deepEqual(orderLeagueTable([]), { rows: [], ranked: true });
});
