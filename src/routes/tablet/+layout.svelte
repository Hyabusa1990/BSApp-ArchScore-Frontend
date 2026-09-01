<script lang="ts">
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	// PWA-Fähigkeit ist bewusst auf genau diese Route-Subtree beschränkt (Issue #18) — Manifest-
	// Link + Service-Worker-Registrierung passieren deshalb nur hier, nicht im Root-Layout.
	// `@vite-pwa/sveltekit` injiziert von sich aus nichts in app.html, die Scope-Isolierung ergibt
	// sich also allein daraus, dass wir die virtuellen Module nur in diesem Layout aufrufen.
	onMount(() => {
		// pwaInfo ist undefined im SSR-Build und im Dev-Modus (devOptions.enabled ist bewusst aus,
		// siehe vite.config.ts) — dort bleibt es beim bestehenden MSW-Verhalten, kein SW-Konflikt.
		if (!pwaInfo) return;

		let registration: ServiceWorkerRegistration | undefined;

		(async () => {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegisteredSW(_swScriptUrl, reg) {
					registration = reg;
				}
			});
		})();

		// iOS/Safari hat kein natives "Update verfügbar"-Prompting wie Chrome — zusätzlich zum
		// Standard-Update-Check beim Foregrounden erneut prüfen, damit ein bereits installiertes
		// Homescreen-Icon zeitnah nachzieht (Issue #18).
		function onVisibilityChange() {
			if (document.visibilityState === 'visible') registration?.update();
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	});
</script>

<svelte:head>
	{#if pwaInfo}
		{@html pwaInfo.webManifest.linkTag}
	{/if}
	<!-- theme-color/apple-touch-icon kommen schon site-weit aus app.html (ArchScore-Branding) —
	     hier nur, was für den installierten Standalone-Modus zusätzlich nötig ist. -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="ArchScore Spotter" />
</svelte:head>

{@render children()}
