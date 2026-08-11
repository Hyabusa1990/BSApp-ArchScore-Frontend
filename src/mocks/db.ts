import type { User } from '$lib/api/auth';
import { users } from './fixtures';

/**
 * In-memory Fake-Backend-Zustand für einen Dev-Session-Lauf.
 * Kein Persistenz über Reload hinweg — bei Bedarf später auf localStorage umstellen.
 */

export const DEV_PASSWORD = 'test1234';

function clone<T>(value: T): T {
	return structuredClone(value);
}

export const db = {
	usersByUsername: new Map<string, User>(Object.values(users).map((u) => [u.username, clone(u)])),
	usersById: new Map<string, User>(Object.values(users).map((u) => [u.id, clone(u)])),
	accessTokens: new Map<string, string>(), // token -> user id
	refreshTokens: new Map<string, string>() // token -> user id
};

export function issueTokens(user: User) {
	const access = `mock-access.${user.id}.${crypto.randomUUID()}`;
	const refresh = `mock-refresh.${user.id}.${crypto.randomUUID()}`;
	db.accessTokens.set(access, user.id);
	db.refreshTokens.set(refresh, user.id);
	return { access, refresh };
}

/** Refresh-Rotation: altes Refresh-Token ungültig machen, neues Paar ausstellen. */
export function rotateTokens(refreshToken: string): { access: string; refresh: string } | null {
	const userId = db.refreshTokens.get(refreshToken);
	if (!userId) return null;
	db.refreshTokens.delete(refreshToken);
	const user = db.usersById.get(userId);
	if (!user) return null;
	return issueTokens(user);
}

export function userFromAccessToken(authHeader: string | null): User | undefined {
	const token = authHeader?.replace(/^Bearer\s+/i, '');
	if (!token) return undefined;
	const userId = db.accessTokens.get(token);
	return userId ? db.usersById.get(userId) : undefined;
}

export function revokeRefreshToken(refreshToken: string) {
	db.refreshTokens.delete(refreshToken);
}
