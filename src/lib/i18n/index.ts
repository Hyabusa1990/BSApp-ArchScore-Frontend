import { browser } from '$app/environment';
import { register as registerLocale, init, getLocaleFromNavigator, locale } from 'svelte-i18n';

export const languages = [
	{ code: 'en', label: 'EN — English' },
	{ code: 'de', label: 'DE — Deutsch' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

const defaultLocale: LanguageCode = 'en';

const localeModules = import.meta.glob('./*.json');
languages.forEach(({ code }) =>
	registerLocale(code, localeModules[`./${code}.json`] as () => Promise<unknown>)
);

let initialized = false;

export function setupI18n() {
	if (initialized) return;
	initialized = true;

	const initialLocale = browser
		? (localStorage.getItem('locale') ?? getLocaleFromNavigator() ?? 'en')
		: 'en';

	init({ fallbackLocale: defaultLocale, initialLocale });
}

export function setLocale(lang: string) {
	locale.set(lang);
	if (browser) localStorage.setItem('locale', lang);
}

export { locale };