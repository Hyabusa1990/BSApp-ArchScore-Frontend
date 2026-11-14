import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	HALF_W,
	PAGE_H,
	PAGE_W,
	QUARTER_H,
	computeQuarterLayout,
	computeSheetLayout,
	groupPairs,
	pdfFileName
} from './tablet-qr-pdf';

test('QR passt mit Rand in die A5-Hälfte', () => {
	for (const h of [0, 1] as const) {
		const l = computeSheetLayout(h);
		assert.ok(l.qrX - l.x0 >= 10);
		assert.ok(l.x0 + HALF_W - (l.qrX + l.qrSize) >= 10);
		assert.ok(l.qrY + l.qrSize < l.labelY);
		assert.ok(l.labelY <= PAGE_H);
	}
});

test('Überschrift über dem QR', () => {
	const l = computeSheetLayout(0);
	assert.ok(l.headingY < l.qrY);
});

test('Hälften symmetrisch', () => {
	const a = computeSheetLayout(0);
	const b = computeSheetLayout(1);
	assert.equal(b.qrX - a.qrX, HALF_W);
	assert.equal(b.centerX - a.centerX, HALF_W);
	assert.equal(a.qrY, b.qrY);
	assert.equal(a.qrSize, b.qrSize);
});

test('Paargruppierung 1|2, 3|4, 5|6, 7|8', () => {
	assert.deepEqual(groupPairs([1, 2, 3, 4, 5, 6, 7, 8]), [
		[1, 2],
		[3, 4],
		[5, 6],
		[7, 8]
	]);
	assert.deepEqual(groupPairs([3, 1, 2]), [
		[1, 2],
		[3, null]
	]);
});

test('Dateiname bereinigt', () => {
	assert.equal(pdfFileName('Spieltag 1/2: Ü'), 'spotter-qr-Spieltag_1_2_U.pdf');
	assert.equal(pdfFileName('///'), 'spotter-qr-veranstaltung.pdf');
});

test('Dateiname mit eigenem Präfix', () => {
	assert.equal(pdfFileName('Spieltag 1', 'team-qr'), 'team-qr-Spieltag_1.pdf');
});

test('A6-Viertel: alles innerhalb des Viertels mit Rand, Überschrift über QR, QR über Label', () => {
	for (const i of [0, 1, 2, 3] as const) {
		const l = computeQuarterLayout(i);
		const x0 = (i % 2) * HALF_W;
		const y0 = Math.floor(i / 2) * QUARTER_H;
		assert.equal(l.x0, x0);
		assert.ok(l.qrX - x0 >= 10);
		assert.ok(x0 + HALF_W - (l.qrX + l.qrSize) >= 10);
		assert.ok(l.headingY > y0 && l.headingY < l.qrY);
		assert.ok(l.qrY + l.qrSize < l.labelY);
		assert.ok(l.labelY < y0 + QUARTER_H);
		assert.ok(x0 + HALF_W <= PAGE_W);
	}
});

test('A6-Viertel: gleiche Geometrie in jedem Viertel, nur verschoben', () => {
	const a = computeQuarterLayout(0);
	const d = computeQuarterLayout(3);
	assert.equal(d.qrX - a.qrX, HALF_W);
	assert.equal(d.qrY - a.qrY, QUARTER_H);
	assert.equal(d.qrSize, a.qrSize);
});
