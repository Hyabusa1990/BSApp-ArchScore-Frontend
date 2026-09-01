import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		// PWA-Fähigkeit NUR für die Spotter-Tablet-Route (Issue #18) — Display/Login/Verwaltung
		// bleiben bewusst außen vor. `@vite-pwa/sveltekit` injiziert selbst nichts in app.html (der
		// HTML-Transform-Teil von vite-plugin-pwa wird durch einen reinen Build-Plugin ersetzt), die
		// Scope-Isolierung passiert also ausschließlich dadurch, dass Manifest-Link + SW-Registrierung
		// nur in src/routes/tablet/+layout.svelte über die virtuellen Module aufgerufen werden.
		SvelteKitPWA({
			registerType: 'autoUpdate',
			// Wir registrieren den Service Worker selbst (scoped, siehe tablet/+layout.svelte) statt
			// ihn sitewide per <script> in app.html injizieren zu lassen.
			injectRegister: false,
			// SvelteKits eigenes Vite-`base` ist relativ ('./'), was vite-plugin-pwa unverändert in die
			// generierte SW-Registrierungs-URL übernimmt ('./sw.js' statt '/sw.js'). Das würde beim
			// Aufruf aus einer verschachtelten Route wie /tablet/<token>/<scheibennummer> auf die
			// falsche URL auflösen (Workbox löst relative scriptURLs gegen die aktuelle Dokument-URL
			// auf) — deshalb hier explizit ein absolutes base erzwingen.
			base: '/',
			scope: '/tablet/',
			// Eigener Dateiname, damit das generierte Manifest NICHT das schon vorhandene
			// site-weite static/manifest.webmanifest (App-Branding, siehe app.html) am selben
			// Pfad überschreibt — sonst würde build/manifest.webmanifest stillschweigend durch
			// dieses hier ersetzt.
			manifestFilename: 'tablet-manifest.webmanifest',
			manifest: {
				name: 'ArchScore Spotter',
				short_name: 'Spotter',
				description: 'Pfeilwerte-Erfassung für Spotter (ArchScore)',
				scope: '/tablet/',
				// Bewusst kein start_url: /tablet/ existiert als Route nicht (nur .../[token]/
				// [scheibennummer]). Fehlt der Key im Manifest, nutzt der Browser laut Web-App-
				// Manifest-Spec beim Installieren die URL der verlinkenden Seite — also automatisch
				// die token-spezifische Spotter-Seite, von der aus der jeweilige Spotter installiert.
				start_url: undefined,
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#4779e8',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{
						src: '/icon-512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
			// workbox: Standard-Precaching reicht (Issue #18: kein Offline-Anspruch, keine eigene
			// Caching-Strategie nötig).
		})
	],
	server: {
		proxy: {
			'/api': 'http://localhost:8000'
		}
	}
});
