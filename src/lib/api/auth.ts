import { apiClient } from './client';

export interface TokenResponse {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export interface MessageResponse {
	code: string;
	message: string;
}

export type Role = 'user' | 'admin';

export interface User {
	id: string;
	email: string;
	/**
	 * Nicht Teil des Fawkes-Kontrakts (`GET /Auth/me` liefert nur `{id, email}`) — optional/
	 * unused bis zur separaten Klärung des Ownership-Modells, s. CLAUDE.md "Permissions/roles".
	 */
	role?: Role;
}

export const authApi = {
	login: (email: string, password: string) =>
		apiClient.post<TokenResponse>('/Auth/login', { email, password }),

	refresh: (refreshToken: string) =>
		apiClient.post<TokenResponse>('/Auth/refresh', { refreshToken }),

	register: (email: string, password: string) =>
		apiClient.post<MessageResponse>('/Auth/register', { email, password }),

	// /Auth/register/{token} ist kein Invite-Flow, sondern E-Mail-Verifizierung NACH der
	// Registrierung (siehe Issue #12) — kein Bearer laut Spec, kein Body.
	verifyRegistration: (token: string) =>
		apiClient.post<MessageResponse>(`/Auth/register/${token}`, undefined),

	me: (token: string) => apiClient.get<User>('/Auth/me', token),

	// Eigenständige Funktion, nicht Teil des in #3 entfernten Profil-Edit-Formulars.
	changePassword: (token: string, currentPassword: string, newPassword: string) =>
		apiClient.post<MessageResponse>(
			'/Auth/change-password',
			{ currentPassword, newPassword },
			token
		),

	logout: (token: string) => apiClient.post<void>('/Auth/logout', undefined, token)
};
