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
			const { access } = await authApi.refresh(this.refreshToken);
			this.accessToken = access;
			if (browser) localStorage.setItem('access_token', access);
			this.user = await authApi.me(access);
			return true;
		} catch {
			return false;
		}
	}

	async login(email: string, password: string) {
		this.loading = true;
		try {
			const tokens = await authApi.login(email, password);
			this.accessToken = tokens.access;
			this.refreshToken = tokens.refresh;
			if (browser) {
				localStorage.setItem('access_token', tokens.access);
				localStorage.setItem('refresh_token', tokens.refresh);
			}
			this.user = await authApi.me(tokens.access);
		} finally {
			this.loading = false;
		}
	}

	async register(email: string, password: string, passwordConfirm: string) {
		this.loading = true;
		try {
			return await authApi.register(email, password, passwordConfirm);
		} finally {
			this.loading = false;
		}
	}

	logout() {
		this.clear();
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
