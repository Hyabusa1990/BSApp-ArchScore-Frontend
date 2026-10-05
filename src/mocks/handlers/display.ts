import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import { getDisplayData, registerDevice } from '../displays';

/**
 * Folgt seit Issue #17 dem echten Fawkes-`DisplayController`-Kontrakt (`GET /displays/register`,
 * `GET /displays/data`, Pfad-Sync 2026-09-28) statt des früheren JWT+PIN-Fake-Schemas — siehe
 * CLAUDE.md "Spec-vs-Implementation-Drift" und Issue #1 für den Auth-Hintergrund allgemein.
 */

function unauthorized() {
	return HttpResponse.json(
		{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
		{ status: 401 }
	);
}

export const displayHandlers = [
	http.get(`${API_URL}/displays/register`, () => HttpResponse.json(registerDevice())),

	http.get(`${API_URL}/displays/data`, ({ request }) => {
		const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
		const data = accessToken ? getDisplayData(accessToken) : undefined;

		if (!data) return unauthorized();
		return HttpResponse.json(data);
	})
];
