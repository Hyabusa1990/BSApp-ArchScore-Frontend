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
	usersByEmail: new Map<string, User>(Object.values(users).map((u) => [u.email, clone(u)])),
	usersById: new Map<string, User>(Object.values(users).map((u) => [u.id, clone(u)])),
	accessTokens: new Map<string, string>(), // token -> user id
	refreshTokens: new Map<string, string>(), // token -> user id
	// user id -> per Auth/change-password (#11) gesetztes Passwort, überschreibt DEV_PASSWORD
	// für genau diesen User für den Rest des Mock-Laufs.
	passwordOverrides: new Map<string, string>(),
	// Verify-Token (siehe Issue #12) -> user id, ausgestellt bei POST /Auth/register, verbraucht
	// bei POST /Auth/register/{token}. Kein echter Mail-Versand im Mock — der Token wird der
	// Register-Antwort als Dev-Komfort direkt beigelegt.
	pendingVerifications: new Map<string, string>()
};

/** Aktuell gültiges Passwort des Users — DEV_PASSWORD, außer per change-password überschrieben. */
export function passwordFor(userId: string): string {
	return db.passwordOverrides.get(userId) ?? DEV_PASSWORD;
}

const ACCESS_TOKEN_TTL_SECONDS = 3600;

export function issueTokens(user: User) {
	const accessToken = `mock-access.${user.id}.${crypto.randomUUID()}`;
	const refreshToken = `mock-refresh.${user.id}.${crypto.randomUUID()}`;
	db.accessTokens.set(accessToken, user.id);
	db.refreshTokens.set(refreshToken, user.id);
	return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/** Refresh-Rotation: altes Refresh-Token ungültig machen, neues Paar ausstellen. */
export function rotateTokens(
	refreshToken: string
): { accessToken: string; refreshToken: string; expiresIn: number } | null {
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
