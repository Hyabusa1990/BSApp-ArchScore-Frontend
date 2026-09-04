<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { Modal, ModalHeader, ModalBody, Alert, Button } from '@sveltestrap/sveltestrap';
	import QrScanner from 'qr-scanner';

	/**
	 * Eingebauter QR-Scanner für die Spotter-Tablet-Seite (Issue #19) — ersetzt den Umweg über
	 * die OS-Kamera-App, besonders im PWA-Standalone-Modus (#18) ohne Adressleiste. Bewusst ein
	 * Sveltestrap-Modal (nicht Vollbild), Kamera-Lifecycle läuft strikt an `isOpen` +
	 * Scan-Zustand gekoppelt über `$effect`-Cleanup, damit beim Schließen (X, Abbrechen,
	 * erfolgreicher Wechsel) nie ein Kamera-Permission-Indicator hängen bleibt.
	 */
	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}
	let { isOpen, onClose }: Props = $props();

	type ScanState = 'scanning' | 'confirm';
	let scanState = $state<ScanState>('scanning');
	let errorMsg = $state<string | null>(null);
	let pendingToken = $state<string | null>(null);
	let pendingScheibennummer = $state<string | null>(null);
	let videoEl = $state<HTMLVideoElement | undefined>();

	// Seit Issue #22 ist das erste Segment die `fixtureUniqueId` der Veranstaltung direkt (ein
	// UUID4), kein eigenes Pairing-Token mehr — Regex bleibt bewusst locker (kein strenges
	// UUID4-Pattern) statt das Format hier zu duplizieren, das ist weiterhin Sache des Backends
	// (401 beim Laden bei unbekannter `fixtureUniqueId`).
	const TABLET_PATH_RE = /^\/tablet\/([^/]+)\/(\d+)$/;

	function handleDecoded(text: string) {
		if (scanState !== 'scanning') return;
		let url: URL;
		try {
			url = new URL(text, window.location.origin);
		} catch {
			errorMsg = $_('qr_scan.invalid_code');
			return;
		}
		const match = url.origin === window.location.origin && TABLET_PATH_RE.exec(url.pathname);
		if (!match) {
			errorMsg = $_('qr_scan.invalid_code');
			return;
		}
		pendingToken = match[1];
		pendingScheibennummer = match[2];
		errorMsg = null;
		scanState = 'confirm';
	}

	// Zustand bei jedem Öffnen zurücksetzen — unabhängig vom Kamera-Start-Effekt unten, damit ein
	// erneutes Öffnen nie mitten in 'confirm' oder mit einer alten Fehlermeldung startet.
	$effect(() => {
		if (isOpen) {
			scanState = 'scanning';
			errorMsg = null;
			pendingToken = null;
			pendingScheibennummer = null;
		}
	});

	// Kamera läuft nur, solange das Modal offen ist UND wir uns im Scan-Zustand befinden — sobald
	// ein gültiger Code erkannt wird (scanState -> 'confirm') oder das Modal schließt, stoppt der
	// Cleanup den Stream. Kein manuelles stop() an anderer Stelle nötig.
	$effect(() => {
		if (!isOpen || scanState !== 'scanning' || !videoEl) return;
		const scanner = new QrScanner(videoEl, (result) => handleDecoded(result.data), {
			returnDetailedScanResult: true,
			highlightScanRegion: true,
			highlightCodeOutline: true
		});
		scanner.start().catch(() => {
			errorMsg = $_('qr_scan.camera_error');
		});
		return () => {
			scanner.stop();
			scanner.destroy();
		};
	});

	function confirmSwitch() {
		if (!pendingToken || !pendingScheibennummer) return;
		const path = resolve('/tablet/[fixtureUniqueId]/[scheibennummer]', {
			fixtureUniqueId: pendingToken,
			scheibennummer: pendingScheibennummer
		});
		onClose();
		goto(path);
	}
</script>

<Modal {isOpen} toggle={onClose}>
	<ModalHeader toggle={onClose}>{$_('qr_scan.title')}</ModalHeader>
	<ModalBody>
		{#if scanState === 'confirm'}
			<div class="text-center py-3">
				<i class="bi bi-qr-code-scan fs-1 d-block mb-3"></i>
				<p class="mb-3">{$_('qr_scan.confirm_message')}</p>
				<div class="d-flex gap-2 justify-content-center">
					<Button color="outline-secondary" onclick={onClose}>
						{$_('qr_scan.confirm_cancel')}
					</Button>
					<Button color="primary" onclick={confirmSwitch}>
						{$_('qr_scan.confirm_switch')}
					</Button>
				</div>
			</div>
		{:else}
			<div class="qr-video-wrap ratio ratio-1x1">
				<video bind:this={videoEl} class="w-100 h-100" muted playsinline></video>
			</div>
			{#if errorMsg}
				<Alert color="danger" class="mt-3 mb-0">{errorMsg}</Alert>
			{/if}
		{/if}
	</ModalBody>
</Modal>

<style>
	.qr-video-wrap {
		background: #000;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.qr-video-wrap video {
		object-fit: cover;
	}
</style>
