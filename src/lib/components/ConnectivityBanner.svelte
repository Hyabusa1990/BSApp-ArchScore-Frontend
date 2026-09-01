<script lang="ts">
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { _ } from 'svelte-i18n';

	/**
	 * Ein generischer "Verbindungsprobleme"-Hinweis, zwei visuelle Varianten (Issue #20):
	 * `prominent` fürs Spotter-Tablet (gut sichtbar, der Spotter soll das nicht übersehen),
	 * `subtle` fürs Display (dezent in einer Ecke — die Trefferanzeige läuft laut
	 * FACHLICHKEIT.md bewusst dominant für 20–30m Leseabstand, der Banner darf dem nicht im
	 * Weg stehen). Kein Retry-Button, kein fehlerspezifischer Text — reagiert rein auf
	 * `connectivity.isOffline` aus dem gemeinsamen Store.
	 */
	interface Props {
		variant: 'subtle' | 'prominent';
	}
	let { variant }: Props = $props();
</script>

{#if connectivity.isOffline}
	<div class="connectivity-banner connectivity-banner-{variant}">
		<i class="bi bi-wifi-off"></i>
		<span>{$_('connectivity.offline_message')}</span>
	</div>
{/if}

<style>
	.connectivity-banner {
		position: fixed;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		z-index: 1060;
		pointer-events: none;
	}

	.connectivity-banner-prominent {
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		background: #dc3545;
		color: #fff;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	/* Fallback-Werte greifen, falls die Komponente mal außerhalb von .monitor-page landet —
	   normalerweise erbt sie die --monitor-*-Custom-Properties von dort (kaskadieren über den
	   DOM-Baum, nicht über Sveltes Style-Scoping), passt sich also automatisch ans Hell-/
	   Dunkel-Theme des Displays an, ohne dass diese Komponente das Theme selbst kennen muss. */
	.connectivity-banner-subtle {
		bottom: 0.75rem;
		right: 0.75rem;
		background: var(--monitor-elevated, rgba(0, 0, 0, 0.55));
		color: var(--monitor-muted, rgba(255, 255, 255, 0.75));
		font-size: 0.8rem;
		padding: 0.3rem 0.6rem;
		border-radius: 0.4rem;
	}
</style>
