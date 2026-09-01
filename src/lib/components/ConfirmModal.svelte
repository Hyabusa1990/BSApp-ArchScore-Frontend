<script lang="ts">
	import {
		Modal,
		ModalHeader,
		ModalBody,
		ModalFooter,
		Button,
		Icon,
		Spinner
	} from '@sveltestrap/sveltestrap';
	import type { Snippet } from 'svelte';

	/**
	 * Generischer Bestätigungsdialog fürs App-Design (Bootstrap-Modal statt `confirm()`) — ersetzt
	 * `window.confirm` überall dort, wo eine destruktive/folgenreiche Aktion erst nach expliziter
	 * Bestätigung ausgelöst werden soll. Bewusst vollständig "controlled": die Komponente hält
	 * keinen eigenen Open/Closed-State, sondern nur `isOpen` von außen — Schließen (Cancel-Button,
	 * X, Backdrop-Klick, Escape) ruft immer `onCancel` auf, nie eine interne Zustandsänderung.
	 * Aufrufer entscheidet selbst, ob/wann `isOpen` wieder auf false geht (z. B. erst nach
	 * erfolgreichem Request), daher auch das eigene `loading`, statt automatisch zu schließen.
	 */
	interface Props {
		isOpen: boolean;
		title: string;
		message?: string;
		confirmLabel: string;
		cancelLabel: string;
		confirmColor?: string;
		icon?: string;
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		children?: Snippet;
	}

	let {
		isOpen,
		title,
		message = '',
		confirmLabel,
		cancelLabel,
		confirmColor = 'primary',
		icon = 'exclamation-triangle-fill',
		loading = false,
		onConfirm,
		onCancel,
		children
	}: Props = $props();
</script>

<Modal {isOpen} toggle={onCancel} centered>
	<ModalHeader toggle={onCancel}>
		<Icon name={icon} class="text-{confirmColor} me-2" />
		{title}
	</ModalHeader>
	<ModalBody>
		{#if children}
			{@render children()}
		{:else}
			<p class="mb-0">{message}</p>
		{/if}
	</ModalBody>
	<ModalFooter>
		<Button color="outline-secondary" disabled={loading} onclick={onCancel}>
			{cancelLabel}
		</Button>
		<Button color={confirmColor} disabled={loading} onclick={onConfirm}>
			{#if loading}<Spinner size="sm" class="me-2" />{/if}
			{confirmLabel}
		</Button>
	</ModalFooter>
</Modal>
