import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeShots, normalizeShotsOrNull } from './shots';

test('Füllzeichen am Ende werden entfernt', () => {
	assert.equal(normalizeShots('+     '), '+');
	assert.equal(normalizeShots('+0899 '), '+0899');
	assert.equal(normalizeShots('+08999'), '+08999');
});

test('leere, nur aufgefüllte und fehlende Werte ergeben einen leeren String', () => {
	assert.equal(normalizeShots('      '), '');
	assert.equal(normalizeShots(''), '');
	assert.equal(normalizeShots(null), '');
	assert.equal(normalizeShots(undefined), '');
});

test('normalizeShotsOrNull lässt null stehen', () => {
	assert.equal(normalizeShotsOrNull(null), null);
	assert.equal(normalizeShotsOrNull('+     '), '+');
});
