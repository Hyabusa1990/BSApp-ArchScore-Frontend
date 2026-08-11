import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import { getContentForJwt, registerDisplay } from '../displays';

/**
 * Auth weicht bewusst vom `scoring`-Referenzprojekt ab: JWT + PIN statt reiner UUID
 * (`display_token`) — siehe CLAUDE.md "Spec-vs-Implementation-Drift" und Issue #1.
 */

export const displayHandlers = [
	http.post(`${API_URL}/display/register`, () => HttpResponse.json(registerDisplay())),

	http.get(`${API_URL}/display/content`, ({ request }) => {
		const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
		const content = jwt ? getContentForJwt(jwt) : undefined;

		if (!content) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(content);
	})
];
