import { browser } from '$app/environment';
import { authApi, type User } from '$lib/api/auth';
import { APIError } from '$lib/api/client';

class AuthStore {
	accessToken = $state<string | null>(null);
	refreshToken = $state<string | null>(null);
	user = $state<User | null>(null);
	loading = $state(false);
	initialized = $state(false);

	get isAuthenticated() {
		return this.accessToken !== null;
	}

	constructor() {
		if (browser) {
			this.accessToken = localStorage.getItem('access_token');
			this.refreshToken = localStorage.getItem('refresh_token');
		}
	}

	async init() {
		if (!this.accessToken) {
			this.initialized = true;
			return;
		}
		try {
			this.user = await authApi.me(this.accessToken);
		} catch (e) {
			if (e instanceof APIError && e.status === 401) {
				const ok = await this.tryRefresh();
				if (!ok) this.clear();
			}
		} finally {
			this.initialized = true;
		}
	}

	async tryRefresh(): Promise<boolean> {
		if (!this.refreshToken) return false;
		try {
			const tokens = await authApi.refresh(this.refreshToken);
			this.setTokens(tokens.accessToken, tokens.refreshToken);
			this.user = await authApi.me(tokens.accessToken);
			return true;
		} catch {
			return false;
		}
	}

	async login(email: string, password: string) {
		this.loading = true;
		try {
			const tokens = await authApi.login(email, password);
			this.setTokens(tokens.accessToken, tokens.refreshToken);
			this.user = await authApi.me(tokens.accessToken);
		} finally {
			this.loading = false;
		}
	}

	async register(email: string, password: string) {
		this.loading = true;
		try {
			return await authApi.register(email, password);
		} finally {
			this.loading = false;
		}
	}

	async logout() {
		const token = this.accessToken;
		this.clear();
		if (token) {
			// Best-effort: lokaler Logout läuft immer durch, auch wenn die serverseitige
			// Refresh-Token-Invalidierung fehlschlägt (z.B. Token schon abgelaufen).
			try {
				await authApi.logout(token);
			} catch {
				/* ignore */
			}
		}
	}

	private setTokens(accessToken: string, refreshToken: string) {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
		if (browser) {
			localStorage.setItem('access_token', accessToken);
			localStorage.setItem('refresh_token', refreshToken);
		}
	}

	private clear() {
		this.accessToken = null;
		this.refreshToken = null;
		this.user = null;
		if (browser) {
			localStorage.removeItem('access_token');
			localStorage.removeItem('refresh_token');
		}
	}
}

export const auth = new AuthStore();
