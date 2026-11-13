import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMatchBeendet } from './matchResult';

test('laufendes Match ist nicht beendet', () => {
	for (const [a, b] of [
		[0, 0],
		[2, 0],
		[4, 2],
		[5, 3],
		[4, 4]
	]) {
		assert.equal(isMatchBeendet(a, b), false, `${a}:${b}`);
		assert.equal(isMatchBeendet(b, a), false, `${b}:${a}`);
	}
});

test('Sieg ab 6 Satzpunkten beendet das Match', () => {
	for (const [a, b] of [
		[6, 0],
		[6, 4],
		[7, 3]
	]) {
		assert.equal(isMatchBeendet(a, b), true, `${a}:${b}`);
		assert.equal(isMatchBeendet(b, a), true, `${b}:${a}`);
	}
});

test('5:5 ist beendet (Unentschieden)', () => {
	assert.equal(isMatchBeendet(5, 5), true);
});

test('fehlende Werte ergeben nicht beendet', () => {
	assert.equal(isMatchBeendet(null, 6), false);
	assert.equal(isMatchBeendet(6, undefined), false);
	assert.equal(isMatchBeendet(null, null), false);
});
