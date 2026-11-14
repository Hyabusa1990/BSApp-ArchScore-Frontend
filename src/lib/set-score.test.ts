import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adjustSetScore, setScoreOf } from './set-score';

test('setScoreOf summiert 10 ("+") und Miss ("0")', () => {
	assert.equal(setScoreOf('+08999'), 10 + 0 + 8 + 9 + 9 + 9);
	assert.equal(setScoreOf('000000'), 0);
	assert.equal(setScoreOf('++++++'), 60);
});

test('+1 erhöht den niedrigsten Pfeil', () => {
	assert.equal(adjustSetScore('987789', 1), '988789');
});

test('+1 bei Gleichstand: linker Pfeil', () => {
	assert.equal(adjustSetScore('887788', 1), '888788');
	assert.equal(adjustSetScore('778899', 1), '878899');
});

test('-1 senkt den höchsten Pfeil', () => {
	assert.equal(adjustSetScore('987789', -1), '887789');
});

test('-1 bei Gleichstand: linker Pfeil', () => {
	assert.equal(adjustSetScore('998899', -1), '898899');
});

test('Miss und 10 werden korrekt kodiert', () => {
	assert.equal(adjustSetScore('0+++++', 1), '1+++++');
	assert.equal(adjustSetScore('9+++++', 1), '++++++');
	assert.equal(adjustSetScore('+00000', -1), '900000');
	assert.equal(adjustSetScore('100000', -1), '000000');
});

test('Grenzen: Summe 60 und 0', () => {
	assert.equal(adjustSetScore('++++++', 1), null);
	assert.equal(adjustSetScore('000000', -1), null);
	assert.notEqual(adjustSetScore('++++++', -1), null);
	assert.notEqual(adjustSetScore('000000', 1), null);
});

test('Summe ändert sich um genau 1, Länge bleibt 6', () => {
	for (const s of ['987789', '+0+0+0', '555555', '+++++9', '000001']) {
		const up = adjustSetScore(s, 1);
		const down = adjustSetScore(s, -1);
		if (up !== null) {
			assert.equal(up.length, 6);
			assert.equal(setScoreOf(up), setScoreOf(s) + 1);
		}
		if (down !== null) {
			assert.equal(down.length, 6);
			assert.equal(setScoreOf(down), setScoreOf(s) - 1);
		}
	}
});

test('unvollständige oder überlange Sätze ergeben null', () => {
	assert.equal(adjustSetScore('', 1), null);
	assert.equal(adjustSetScore('+0899', 1), null);
	assert.equal(adjustSetScore('+089999', -1), null);
});
