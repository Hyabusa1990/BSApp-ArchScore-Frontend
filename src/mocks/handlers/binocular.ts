import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import { bestaetigeSatz, getScheibe, setShots } from '../binoculars';

/**
 * Pfade folgen dem Fawkes-Spotter-Kontrakt (siehe binocular.ts) — Token im URL-Pfad ist die
 * `fixtureUniqueId`, kein Authorization-Header nötig (Auth läuft über die schwer zu erratende
 * `fixtureUniqueId` selbst). 401 bei unbekanntem Token, 404 mit `detail: 'Event nicht
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
	http.get(`${API_URL}/fixtures/:token/targets/:scheibennummer/spotter/info`, ({ params }) => {
		const scheibennummer = Number(params.scheibennummer);
		return toResponse(getScheibe(String(params.token), scheibennummer));
	}),

	http.put(
		`${API_URL}/fixtures/:token/targets/:scheibennummer/spotter/shots`,
		async ({ params, request }) => {
			const scheibennummer = Number(params.scheibennummer);
			const body = (await request.json()) as { shots?: string };
			if (typeof body.shots !== 'string') {
				return HttpResponse.json({ detail: 'shots fehlt oder ungültig' }, { status: 422 });
			}
			return toResponse(setShots(String(params.token), scheibennummer, body.shots));
		}
	),

	http.put(
		`${API_URL}/fixtures/:token/targets/:scheibennummer/spotter/shots/confirm`,
		({ params }) => {
			const scheibennummer = Number(params.scheibennummer);
			return toResponse(bestaetigeSatz(String(params.token), scheibennummer));
		}
	)
];
