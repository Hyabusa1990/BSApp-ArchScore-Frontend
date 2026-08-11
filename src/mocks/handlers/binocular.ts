import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import { applyPfeil, bestaetigeSatz, getScheibe, undoLast } from '../binoculars';

/**
 * Token steht im URL-Pfad (nicht im Authorization-Header wie bei Display, #1) — siehe
 * binocular.ts und Issue #4. 401 bei unbekanntem Token, 404 mit `detail: 'Event nicht
 * gefunden'` bei bekanntem Token ohne aktives Match auf dieser Scheibe.
 */

function toResponse(outcome: ReturnType<typeof getScheibe>) {
	if (outcome.kind === 'invalid-token') {
		return HttpResponse.json(
			{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
			{ status: 401 }
		);
	}
	if (outcome.kind === 'no-match') {
		return HttpResponse.json({ detail: 'Event nicht gefunden' }, { status: 404 });
	}
	return HttpResponse.json(outcome.match);
}

export const binocularHandlers = [
	http.get(`${API_URL}/binocular/:token/:scheibennummer`, ({ params }) => {
		const scheibennummer = Number(params.scheibennummer);
		return toResponse(getScheibe(String(params.token), scheibennummer));
	}),

	http.post(`${API_URL}/binocular/:token/:scheibennummer/pfeil`, async ({ params, request }) => {
		const scheibennummer = Number(params.scheibennummer);
		const body = (await request.json()) as { ringzahl?: number };
		if (typeof body.ringzahl !== 'number') {
			return HttpResponse.json({ detail: 'ringzahl fehlt oder ungültig' }, { status: 422 });
		}
		return toResponse(applyPfeil(String(params.token), scheibennummer, body.ringzahl));
	}),

	http.post(`${API_URL}/binocular/:token/:scheibennummer/undo`, ({ params }) => {
		const scheibennummer = Number(params.scheibennummer);
		return toResponse(undoLast(String(params.token), scheibennummer));
	}),

	http.post(`${API_URL}/binocular/:token/:scheibennummer/bestaetige_satz`, ({ params }) => {
		const scheibennummer = Number(params.scheibennummer);
		return toResponse(bestaetigeSatz(String(params.token), scheibennummer));
	})
];
