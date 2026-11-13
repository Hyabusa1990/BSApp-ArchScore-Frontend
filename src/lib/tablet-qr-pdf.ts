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
	/** Dateiname-Präfix, Standard `spotter-qr` (Team-QR: `team-qr`). */
	filePrefix?: string;
}): Promise<void> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	const pairs = groupPairs(opts.scheiben);

	for (let p = 0; p < pairs.length; p++) {
		if (p > 0) doc.addPage('a4', 'landscape');
		for (const half of [0, 1] as const) {
			const n = pairs[p][half];
			if (n === null) continue;
			const l = computeSheetLayout(half);
			const png = await QRCode.toDataURL(opts.urlFor(n), {
				width: 1000,
				margin: 1,
				errorCorrectionLevel: 'M'
			});
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(l.headingSize);
			doc.text(opts.heading(n), l.centerX, l.headingY, { align: 'center' });
			doc.addImage(png, 'PNG', l.qrX, l.qrY, l.qrSize, l.qrSize);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(l.labelSize);
			doc.text(opts.eventLabel, l.centerX, l.labelY, { align: 'center', maxWidth: HALF_W - 20 });
		}
		doc.setDrawColor(170);
		doc.setLineWidth(0.2);
		doc.setLineDashPattern([2, 2], 0);
		doc.line(HALF_W, 0, HALF_W, PAGE_H);
		doc.setLineDashPattern([], 0);
	}
	doc.save(pdfFileName(opts.fixtureName, opts.filePrefix));
}
