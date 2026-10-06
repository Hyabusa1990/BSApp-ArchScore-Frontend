<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Bootstrap-Modal ohne Transition. Sveltestrap-`Modal` blendet per Svelte-Transition ein und
	 * setzt `show` erst am Transition-Ende — bei deaktivierten Windows-Animationen (Edge) bleibt
	 * der Dialog dann unsichtbar (gleiche Ursache wie beim früheren `Collapse`-Problem). Hier
	 * wird das Markup direkt per `{#if}` gerendert, `show`/`d-block` sind sofort gesetzt.
	 * Schließen (X, Backdrop-Klick, Escape) ruft immer `toggle` — Zustand liegt beim Aufrufer.
	 */
	interface Props {
		isOpen: boolean;
		toggle: () => void;
		centered?: boolean;
		bodyClass?: string;
		header?: Snippet;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		isOpen,
		toggle,
		centered = false,
		bodyClass = '',
		header,
		children,
		footer
	}: Props = $props();

	let mouseDownTarget: EventTarget | null = null;

	$effect(() => {
		if (!isOpen) return;
		document.body.classList.add('modal-open');
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') toggle();
		};
		document.addEventListener('keydown', onKey);
		return () => {
			document.body.classList.remove('modal-open');
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="modal d-block show"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onmousedown={(e) => (mouseDownTarget = e.target)}
		onclick={(e) => {
			if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) toggle();
		}}
	>
		<div class="modal-dialog" class:modal-dialog-centered={centered} role="document">
			<div class="modal-content">
				{#if header}
					<div class="modal-header">
						<h5 class="modal-title">{@render header()}</h5>
						<button type="button" class="btn-close" aria-label="Close" onclick={toggle}></button>
					</div>
				{/if}
				<div class="modal-body {bodyClass}">
					{@render children()}
				</div>
				{#if footer}
					<div class="modal-footer">
						{@render footer()}
					</div>
				{/if}
			</div>
		</div>
	</div>
	<div class="modal-backdrop show"></div>
{/if}
