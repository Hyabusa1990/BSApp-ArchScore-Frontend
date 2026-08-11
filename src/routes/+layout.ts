import { setupI18n } from '$lib/i18n';
import { waitLocale } from 'svelte-i18n';
import { browser, dev } from '$app/environment';
import { PUBLIC_USE_MOCKS } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	// Fake-API (MSW) nur im Dev-Build im Browser starten, vor allen anderen Fetches.
	// Abschalten: PUBLIC_USE_MOCKS=false in .env, um gegen ein echtes lokales Backend zu laufen.
	if (browser && dev && PUBLIC_USE_MOCKS !== 'false') {
		const { worker } = await import('../mocks/browser');
		await worker.start({ onUnhandledRequest: 'bypass' });
	}

	setupI18n();
	await waitLocale();
};
