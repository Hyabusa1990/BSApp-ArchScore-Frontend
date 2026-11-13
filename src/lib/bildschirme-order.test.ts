import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Device } from './api/bildschirme';
import { sortDevicesByField } from './bildschirme-order';

const dev = (id: number, displayType: Device['displayType'], matchNo: number | null): Device => ({
	id,
	displayType,
	matchNo,
	displayTheme: 'Dark'
});
const ids = (ds: Device[]) => ds.map((d) => d.id);

test('Match nach matchNo, dann Match ohne matchNo, dann Rest nach id', () => {
	const input = [
		dev(1, 'LeagueTable', null),
		dev(2, 'Match', null),
		dev(3, 'Match', 4),
		dev(4, 'None', null),
		dev(5, 'Match', 1),
		dev(6, 'Match', 2)
	];
	assert.deepEqual(ids(sortDevicesByField(input)), [5, 6, 3, 2, 1, 4]);
});

test('Gleichstand innerhalb einer Gruppe nach id', () => {
	const input = [
		dev(9, 'Match', 2),
		dev(3, 'Match', 2),
		dev(8, 'Match', null),
		dev(7, 'Match', null)
	];
	assert.deepEqual(ids(sortDevicesByField(input)), [3, 9, 7, 8]);
});

test('Eingabe wird nicht verändert', () => {
	const input = [dev(2, 'Match', 3), dev(1, 'Match', 1)];
	const copy = [...input];
	const out = sortDevicesByField(input);
	assert.deepEqual(input, copy);
	assert.notEqual(out, input);
});
