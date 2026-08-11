import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import type { User } from '$lib/api/auth';
import { db, DEV_PASSWORD, issueTokens, rotateTokens, userFromAccessToken } from '../db';

/**
 * Spiegelt exakt das, was `src/lib/api/auth.ts` + `profile.ts` heute aufrufen —
 * NICHT die openapi.yaml-Pfade/Feldnamen 1:1 (die weichen aktuell ab, siehe
 * CLAUDE.md "Spec-vs-Implementierung-Drift"). Ziel hier: laufende Dev-Umgebung,
 * kein Spec-Abgleich.
 *
 * Login für alle Fixture-User (siehe fixtures.ts) mit Passwort: test1234
 */

export const authHandlers = [
	http.post(`${API_URL}/token/pair`, async ({ request }) => {
		const body = (await request.json()) as { username?: string; password?: string };
		const user = body.username ? db.usersByUsername.get(body.username) : undefined;

		if (!user || body.password !== DEV_PASSWORD) {
			return HttpResponse.json(
				{ code: 'INVALID_CREDENTIALS', message: 'Benutzername oder Passwort falsch' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(issueTokens(user));
	}),

	http.post(`${API_URL}/token/refresh`, async ({ request }) => {
		const body = (await request.json()) as { refresh?: string };
		const tokens = body.refresh ? rotateTokens(body.refresh) : null;

		if (!tokens) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		return HttpResponse.json({ access: tokens.access });
	}),

	http.get(`${API_URL}/auth/me`, ({ request }) => {
		const user = userFromAccessToken(request.headers.get('Authorization'));
		if (!user) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		return HttpResponse.json(user);
	}),

	http.post(`${API_URL}/auth/register`, async ({ request }) => {
		const body = (await request.json()) as {
			email?: string;
			password?: string;
			password_confirm?: string;
		};
		const errors: { field: string; message: string }[] = [];
		if (!body.email) errors.push({ field: 'email', message: 'Pflichtfeld darf nicht leer sein' });
		if (!body.password || body.password.length < 8)
			errors.push({ field: 'password', message: 'Mindestens 8 Zeichen' });
		if (body.password !== body.password_confirm)
			errors.push({ field: 'password_confirm', message: 'Passwörter stimmen nicht überein' });
		if (db.usersByUsername.has(body.email ?? ''))
			errors.push({ field: 'email', message: 'E-Mail bereits vergeben' });

		if (errors.length) return HttpResponse.json({ errors }, { status: 422 });

		const id = crypto.randomUUID();
		const newUser: User = {
			id,
			username: body.email!,
			email: body.email!,
			role: 'user'
		};
		db.usersByUsername.set(newUser.username, newUser);
		db.usersById.set(id, newUser);
		return HttpResponse.json(newUser, { status: 201 });
	}),

	http.patch(`${API_URL}/auth/profile`, async ({ request }) => {
		const user = userFromAccessToken(request.headers.get('Authorization'));
		if (!user) {
			return HttpResponse.json(
				{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
				{ status: 401 }
			);
		}
		const body = (await request.json()) as { email?: string };
		if (body.email) user.email = body.email;
		return HttpResponse.json(user);
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

	// Noch nicht vom Frontend aufgerufen (auth.svelte.ts.logout() macht rein clientseitiges
	// Clear ohne API-Call) — aber schon in der Spec (/auth/logout) definiert. Vorab gemockt,
	// damit ein künftiger echter Logout-Call sofort funktioniert.
	http.post(`${API_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 }))
];
