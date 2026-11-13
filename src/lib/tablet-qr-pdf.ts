import QRCode from 'qrcode';

/** Geometrie in mm für eine A5-Hälfte (hoch) einer A4-Querseite. */
export const PAGE_W = 297;
export const PAGE_H = 210;
export const HALF_W = PAGE_W / 2;

export interface SheetLayout {
	/** Linke Kante der Hälfte (0 oder HALF_W). */
	x0: number;
	centerX: number;
	headingY: number;
	headingSize: number;
	qrX: number;
	qrY: number;
	qrSize: number;
	labelY: number;
	labelSize: number;
}

/** Reine Geometrie, keine Browser-APIs. `half`: 0 = links, 1 = rechts. */
export function computeSheetLayout(half: 0 | 1): SheetLayout {
	const x0 = half * HALF_W;
	const qrSize = 116;
	return {
		x0,
		centerX: x0 + HALF_W / 2,
		headingY: 38,
		headingSize: 56,
		qrX: x0 + (HALF_W - qrSize) / 2,
		qrY: 56,
		qrSize,
		labelY: 196,
		labelSize: 11
	};
}

export const QUARTER_H = PAGE_H / 2;

/**
 * Geometrie für ein A6-Viertel (quer, 148,5 × 105 mm) einer A4-Querseite, 2 × 2 pro Seite.
 * `index` 0..3: links oben, rechts oben, links unten, rechts unten. Alle Werte absolut auf der
 * Seite (wie bei `computeSheetLayout`).
 */
export function computeQuarterLayout(index: 0 | 1 | 2 | 3): SheetLayout {
	const x0 = (index % 2) * HALF_W;
	const y0 = Math.floor(index / 2) * QUARTER_H;
	const qrSize = 62;
	return {
		x0,
		centerX: x0 + HALF_W / 2,
		headingY: y0 + 17,
		headingSize: 26,
		qrX: x0 + (HALF_W - qrSize) / 2,
		qrY: y0 + 24,
		qrSize,
		labelY: y0 + 98,
		labelSize: 8
	};
}

/** Gruppiert Scheiben paarweise (1|2, 3|4, ...); linke Hälfte = kleinere Nummer. */
export function groupPairs(scheiben: number[]): [number, number | null][] {
	const sorted = [...scheiben].sort((a, b) => a - b);
	const pairs: [number, number | null][] = [];
	for (let i = 0; i < sorted.length; i += 2) pairs.push([sorted[i], sorted[i + 1] ?? null]);
	return pairs;
}

export function pdfFileName(fixtureName: string, prefix = 'spotter-qr'): string {
	const safe = fixtureName
		.normalize('NFKD')
		.replace(/[^\w-]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return `${prefix}-${safe || 'veranstaltung'}.pdf`;
}

export async function buildTabletQrPdf(opts: {
	eventLabel: string;
	fixtureName: string;
	scheiben: number[];
	urlFor: (scheibennummer: number) => string;
	heading: (scheibennummer: number) => string;
	/** `a5` (Standard): 2 pro Seite hochkant; `a6`: 4 pro Seite quer (Team-QR). */
	format?: 'a5' | 'a6';
	/** Dateiname-Präfix, Standard `spotter-qr` (Team-QR: `team-qr`). */
	filePrefix?: string;
}): Promise<void> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	const quarters = opts.format === 'a6';

	// Pro Seite: Liste aus Scheibennummer + Layout. A5: 2 Hälften, A6: 4 Viertel.
	const sorted = [...opts.scheiben].sort((x, y) => x - y);
	const pages: { n: number; layout: SheetLayout }[][] = [];
	if (quarters) {
		for (let i = 0; i < sorted.length; i += 4) {
			pages.push(
				sorted
					.slice(i, i + 4)
					.map((n, k) => ({ n, layout: computeQuarterLayout(k as 0 | 1 | 2 | 3) }))
			);
		}
	} else {
		for (const pair of groupPairs(opts.scheiben)) {
			pages.push(
				([0, 1] as const).flatMap((half) =>
					pair[half] === null ? [] : [{ n: pair[half]!, layout: computeSheetLayout(half) }]
				)
			);
		}
	}

	for (let p = 0; p < pages.length; p++) {
		if (p > 0) doc.addPage('a4', 'landscape');
		for (const { n, layout: l } of pages[p]) {
			const png = await QRCode.toDataURL(opts.urlFor(n), {
				width: 1000,
				margin: 1,
				errorCorrectionLevel: 'M'
			});
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(l.headingSize);
			doc.text(opts.heading(n), l.centerX, l.headingY, { align: 'center', maxWidth: HALF_W - 16 });
			doc.addImage(png, 'PNG', l.qrX, l.qrY, l.qrSize, l.qrSize);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(l.labelSize);
			doc.text(opts.eventLabel, l.centerX, l.labelY, { align: 'center', maxWidth: HALF_W - 20 });
		}
		doc.setDrawColor(170);
		doc.setLineWidth(0.2);
		doc.setLineDashPattern([2, 2], 0);
		doc.line(HALF_W, 0, HALF_W, PAGE_H);
		if (quarters) doc.line(0, QUARTER_H, PAGE_W, QUARTER_H);
		doc.setLineDashPattern([], 0);
	}
	doc.save(pdfFileName(opts.fixtureName, opts.filePrefix));
}
