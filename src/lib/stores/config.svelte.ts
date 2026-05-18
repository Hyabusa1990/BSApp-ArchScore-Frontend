import { API_URL } from '$lib/config';

class ConfigStore {
	allowRegistration = $state(false);
	loaded = $state(false);

	async load() {
		try {
			const res = await fetch(`${API_URL}/config`);
			const data = await res.json();
			this.allowRegistration = data.allow_registration ?? false;
		} catch {
			this.allowRegistration = false;
		} finally {
			this.loaded = true;
		}
	}
}

export const appConfig = new ConfigStore();