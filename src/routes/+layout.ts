import { setupI18n } from '$lib/i18n';
import { waitLocale } from 'svelte-i18n';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	setupI18n();
	await waitLocale();
};