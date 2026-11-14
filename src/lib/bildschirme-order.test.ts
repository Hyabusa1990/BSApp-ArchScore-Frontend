import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Device } from './api/bildschirme';
import { applyCustomOrder, moveDevice, sortDevicesByField } from './bildschirme-order';

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

test('applyCustomOrder: ohne Order Feldreihenfolge', () => {
	const input = [dev(2, 'Match', 3), dev(1, 'Match', 1)];
	assert.deepEqual(ids(applyCustomOrder(input, null)), [1, 2]);
});

test('applyCustomOrder: eigene Reihenfolge, veraltete IDs ignoriert', () => {
	const input = [dev(1, 'Match', 1), dev(2, 'Match', 2), dev(3, 'Match', 3)];
	assert.deepEqual(ids(applyCustomOrder(input, [3, 99, 1, 2])), [3, 1, 2]);
});

test('applyCustomOrder: neue Geräte am Ende in Feldreihenfolge', () => {
	const input = [dev(1, 'Match', 1), dev(2, 'Match', 2), dev(5, 'Match', 4), dev(4, 'Match', 3)];
	assert.deepEqual(ids(applyCustomOrder(input, [2, 1])), [2, 1, 4, 5]);
});

test('moveDevice: vorwärts, rückwärts', () => {
	assert.deepEqual(moveDevice([1, 2, 3, 4], 1, 3), [2, 3, 1, 4]);
	assert.deepEqual(moveDevice([1, 2, 3, 4], 4, 2), [1, 4, 2, 3]);
});

test('moveDevice: gleiche oder unbekannte ID ändert nichts', () => {
	const ids0 = [1, 2, 3];
	assert.deepEqual(moveDevice(ids0, 2, 2), [1, 2, 3]);
	assert.deepEqual(moveDevice(ids0, 9, 2), [1, 2, 3]);
	assert.deepEqual(moveDevice(ids0, 2, 9), [1, 2, 3]);
	assert.notEqual(moveDevice(ids0, 2, 2), ids0);
});
