import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import type { User } from '$lib/api/auth';
import {
	db,
	DEV_PASSWORD,
	issueTokens,
	revokeRefreshToken,
	rotateTokens,
	userFromAccessToken
} from '../db';

/**
 * Pfade/Feldnamen folgen dem Fawkes-Auth-Kontrakt (`ArchScore-SpecsAndDocu/Fawkes-OpenApi.json`,
 * Controller `AuthController`) — Login/Register/Refresh laufen über E-Mail, nicht Username,
 * Token-Shape ist camelCase `{accessToken, refreshToken, expiresIn}`.
 *
 * Login für alle Fixture-User (siehe fixtures.ts) mit Passwort: test1234
 */

export const authHandlers = [
	http.post(`${API_URL}/Auth/login`, async ({ request }) => {
		const body = (await request.json()) as { email?: string; password?: string };
		const user = body.email ? db.usersByEmail.get(body.email) : undefined;

		if (!user || body.password !== DEV_PASSWORD) {
			return HttpResponse.json(
				{ code: 'INVALID_CREDENTIALS', message: 'E-Mail oder Passwort falsch' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(issueTokens(user));
	}),

	http.post(`${API_URL}/Auth/refresh`, async ({ request }) => {
		const body = (await request.json()) as { refreshToken?: string };
		const tokens = body.refreshToken ? rotateTokens(body.refreshToken) : null;

		if (!tokens) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(tokens);
	}),

	http.get(`${API_URL}/Auth/me`, ({ request }) => {
		const user = userFromAccessToken(request.headers.get('Authorization'));
		if (!user) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(user);
	}),

	http.post(`${API_URL}/Auth/register`, async ({ request }) => {
		const body = (await request.json()) as { email?: string; password?: string };
		const errors: { field: string; message: string }[] = [];
		if (!body.email) errors.push({ field: 'email', message: 'Pflichtfeld darf nicht leer sein' });
		if (!body.password || body.password.length < 8)
			errors.push({ field: 'password', message: 'Mindestens 8 Zeichen' });
		if (db.usersByEmail.has(body.email ?? ''))
			errors.push({ field: 'email', message: 'E-Mail bereits vergeben' });

		if (errors.length) return HttpResponse.json({ errors }, { status: 422 });

		const id = crypto.randomUUID();
		const newUser: User = { id, email: body.email!, role: 'user' };
		db.usersByEmail.set(newUser.email, newUser);
		db.usersById.set(id, newUser);
		return HttpResponse.json({ code: 'REGISTERED', message: 'Konto erstellt.' }, { status: 200 });
	}),

	http.post(`${API_URL}/auth/change-password`, async ({ request }) => {
		const user = userFromAccessToken(request.headers.get('Authorization'));
		if (!user) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		const body = (await request.json()) as {
			current_password?: string;
			new_password?: string;
			new_password_confirm?: string;
		};
		if (body.current_password !== DEV_PASSWORD) {
			return HttpResponse.json(
				{ errors: [{ field: 'current_password', message: 'Aktuelles Passwort falsch' }] },
				{ status: 400 }
			);
		}
		if (!body.new_password || body.new_password !== body.new_password_confirm) {
			return HttpResponse.json(
				{
					errors: [{ field: 'new_password_confirm', message: 'Passwörter stimmen nicht überein' }]
				},
				{ status: 400 }
			);
		}
		return HttpResponse.json({ detail: 'Passwort erfolgreich geändert.' });
	}),

	http.post(`${API_URL}/Auth/logout`, ({ request }) => {
		const auth = request.headers.get('Authorization');
		const token = auth?.replace(/^Bearer\s+/i, '');
		const userId = token ? db.accessTokens.get(token) : undefined;
		if (userId) {
			// Alle Refresh-Tokens des Users invalidieren (Mock kennt keine 1:1-Zuordnung
			// Access-/Refresh-Token, daher grobkörnig statt gezielt einzelner Refresh-Token).
			for (const [refreshToken, refreshUserId] of db.refreshTokens) {
				if (refreshUserId === userId) revokeRefreshToken(refreshToken);
			}
		}
		return new HttpResponse(null, { status: 200 });
	})
];
