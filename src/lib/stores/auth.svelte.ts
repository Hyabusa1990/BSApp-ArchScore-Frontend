import { browser } from '$app/environment';
import { authApi, type User } from '$lib/api/auth';
import { APIError, setTokenRefresher } from '$lib/api/client';

class AuthStore {
	accessToken = $state<string | null>(null);
	refreshToken = $state<string | null>(null);
	user = $state<User | null>(null);
	loading = $state(false);
	initialized = $state(false);

	/** Bereits ersetzte Access-Tokens: ein 401 damit heißt „nur veraltet“, nicht „fremdes Token“. */
	private replacedTokens = new Set<string>();
	private refreshing: Promise<boolean> | null = null;

	get isAuthenticated() {
		return this.accessToken !== null;
	}

	constructor() {
		if (browser) {
			this.accessToken = localStorage.getItem('access_token');
			this.refreshToken = localStorage.getItem('refresh_token');
		}
		setTokenRefresher(async (failed) => {
			if (failed !== this.accessToken && !this.replacedTokens.has(failed)) return null;
			if (failed === this.accessToken && !(await this.tryRefresh())) return null;
			return this.accessToken;
		});
	}

	async init() {
		if (!this.accessToken) {
			this.initialized = true;
			return;
		}
		try {
			this.user = await authApi.me(this.accessToken);
		} catch (e) {
			if (e instanceof APIError && e.status === 401) await this.tryRefresh();
		} finally {
			this.initialized = true;
		}
	}

	/**
	 * Erneuert die Tokens (single-flight: parallele Aufrufe teilen sich einen Request, denn Fawkes
	 * rotiert Refresh-Tokens — der zweite Request mit dem alten Token bekäme sonst 401). Abgemeldet
	 * wird nur, wenn Fawkes das Refresh-Token tatsächlich ablehnt (401); bei Netzwerk-/5xx-Fehlern
	 * (z. B. direkt nach dem Aufwachen des Geräts) bleibt die Sitzung erhalten.
	 */
	tryRefresh(): Promise<boolean> {
		this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null));
		return this.refreshing;
	}

	private async doRefresh(): Promise<boolean> {
		// Ein anderer Tab kann bereits rotiert haben — dessen Tokens aus localStorage übernehmen.
		if (browser) this.adoptStoredTokens();
		const used = this.refreshToken;
		if (!used) return false;
		try {
			const tokens = await authApi.refresh(used);
			this.setTokens(tokens.accessToken, tokens.refreshToken);
			this.user = await authApi.me(tokens.accessToken);
			return true;
		} catch (e) {
			if (e instanceof APIError && e.status === 401) {
				// Anderer Tab war schneller: das gespeicherte Refresh-Token ist neuer als unseres.
				if (browser && localStorage.getItem('refresh_token') !== used && this.adoptStoredTokens()) {
					this.user ??= await authApi.me(this.accessToken!).catch(() => null);
					return true;
				}
				this.clear();
			}
			return false;
		}
	}

	private adoptStoredTokens(): boolean {
		const access = localStorage.getItem('access_token');
		const refresh = localStorage.getItem('refresh_token');
		if (!access || !refresh) return false;
		if (this.accessToken && this.accessToken !== access) this.replacedTokens.add(this.accessToken);
		this.accessToken = access;
		this.refreshToken = refresh;
		return true;
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
		const refreshToken = this.refreshToken;
		this.clear();
		if (token) {
			// Best-effort: lokaler Logout läuft immer durch, auch wenn die serverseitige
			// Refresh-Token-Invalidierung fehlschlägt (z.B. Token schon abgelaufen).
			try {
				await authApi.logout(token, refreshToken);
			} catch {
				/* ignore */
			}
		}
	}

	private setTokens(accessToken: string, refreshToken: string) {
		if (this.accessToken && this.accessToken !== accessToken) {
			this.replacedTokens.add(this.accessToken);
		}
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
