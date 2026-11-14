<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { veranstaltungApi, type Veranstaltung } from '$lib/api/veranstaltung';
	import {
		matchkontrolleApi,
		type Match,
		type Begegnung,
		type ScheibenStatus,
		type ScheibenStatusMap
	} from '$lib/api/matchkontrolle';
	import {
		Container,
		Card,
		CardHeader,
		CardBody,
		CardFooter,
		Row,
		Col,
		Badge,
		Alert,
		Button,
		Spinner,
		Modal,
		ModalHeader,
		ModalBody,
		ModalFooter
	} from '@sveltestrap/sveltestrap';

	let { data } = $props<{ data: { id: string } }>();
	const veranstaltungId = $derived(data.id);

	let veranstaltung = $state<Veranstaltung | null>(null);
	let matches = $state<Match[]>([]);
	let scheibenStatus = $state<ScheibenStatusMap>({});
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	// Match-ID, deren Freigabe-Anfrage gerade läuft — verhindert Doppelklicks/Parallel-Freigaben.
	let freigebend = $state<string | null>(null);
	let beendenOffen = $state(false);
	let beendend = $state(false);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	function scheibenFuer(match: Match): number[] {
		return match.begegnungen.flatMap((b) => [b.scheibe_a, b.scheibe_b]);
	}

	// Scheiben einer Begegnung dürfen höchstens einen Satz auseinanderliegen. Technisch möglich,
	// aber ein Fehlerzustand (Spotter einer Scheibe hat zu früh/falsch bestätigt oder freigegeben).
	function satzAbweichung(b: Begegnung): [number, number] | null {
		const sa = scheibenStatus[b.scheibe_a];
		const sb = scheibenStatus[b.scheibe_b];
		if (!sa || !sb) return null;
		return Math.abs(sa.currentSetNo - sb.currentSetNo) > 1
			? [sa.currentSetNo, sb.currentSetNo]
			: null;
	}

	// Beide Scheiben einer Begegnung gehören zum selben Match und werden als Paar angezeigt:
	// abgeschlossen erst, wenn beide es sind; sonst der niedrigere laufende Satz.
	function paarStatus(b: Begegnung): ScheibenStatus | null {
		const stati = [scheibenStatus[b.scheibe_a], scheibenStatus[b.scheibe_b]].filter(
			(st): st is ScheibenStatus => st != null
		);
		if (stati.length === 0) return null;
		const laufend = stati.filter((st) => !st.matchComplete);
		if (laufend.length === 0) return stati[0];
		return laufend.reduce((a, b) => (b.currentSetNo < a.currentSetNo ? b : a));
	}

	// Confirm-Status kommt aus keinem eigenen Matchkontrolle-Endpunkt (Fawkes kennt keinen),
	// sondern pro Scheibe des aktiven Matches über denselben Spotter-Info-Call wie die
	// Binocular-Seite selbst — siehe matchkontrolle.ts.
	async function ladeScheibenStatus() {
		if (!veranstaltung) return;
		const aktivesMatch = matches.find((m) => m.aktiv);
		scheibenStatus = aktivesMatch
			? await matchkontrolleApi.getScheibenStatus(
					veranstaltung.uniqueId,
					scheibenFuer(aktivesMatch)
				)
			: {};
	}

	async function load() {
		loading = true;
		loadError = null;
		try {
			const v = await veranstaltungApi.get(auth.accessToken!, Number(veranstaltungId));
			veranstaltung = v;
			const [ms, phase] = await Promise.all([
				matchkontrolleApi.list(auth.accessToken!, v.id),
				matchkontrolleApi.getPhase(auth.accessToken!, v.id)
			]);
			matches = ms.map((m) => ({ ...m, aktiv: m.nummer === phase.roundNo }));
			await ladeScheibenStatus();
		} catch {
			loadError = $_('matchkontrolle.error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	// Confirm-Status des aktiven Matches regelmäßig aktualisieren, ohne die Match-Liste/Freigabe
	// selbst neu zu laden (gleiche Poll-Kadenz wie die Binocular-Seite, siehe #4).
	$effect(() => {
		if (loading || loadError) return;
		const interval = setInterval(ladeScheibenStatus, 3000);
		return () => clearInterval(interval);
	});

	async function freigeben(match: Match) {
		if (!veranstaltung || freigebend) return;
		freigebend = match.id;

		// Optimistisch sofort anzeigen: genau die angeklickte Karte wird aktiv, alle anderen inaktiv.
		const vorherigeMatches = matches;
		matches = matches.map((m) => ({ ...m, aktiv: m.id === match.id }));

		try {
			await matchkontrolleApi.setPhase(auth.accessToken!, veranstaltung.id, match.nummer);
			await ladeScheibenStatus();
		} catch {
			loadError = $_('matchkontrolle.error_freigeben');
			matches = vorherigeMatches; // Optimistischen Stand verwerfen
		} finally {
			freigebend = null;
		}
	}

	// Runde 0 = keine Runde freigegeben: Tablets gesperrt, Backend berechnet die Endtabelle.
	async function beenden() {
		if (!veranstaltung || beendend || freigebend) return;
		beendend = true;

		const vorherigeMatches = matches;
		matches = matches.map((m) => ({ ...m, aktiv: false }));

		try {
			await matchkontrolleApi.setPhase(auth.accessToken!, veranstaltung.id, 0);
			await ladeScheibenStatus();
		} catch {
			loadError = $_('matchkontrolle.error_beenden');
			matches = vorherigeMatches;
		} finally {
			beendend = false;
			beendenOffen = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('matchkontrolle.title')}</title>
</svelte:head>

<Container class="py-4">
	<a
		href={resolve('/veranstaltungen/[id]', { id: veranstaltungId })}
		class="d-inline-block mb-3 text-decoration-none small"
	>
		&larr; {$_('matchkontrolle.back_btn')}
	</a>

	<div class="d-flex justify-content-between align-items-center mb-4">
		<h4 class="mb-0">{$_('matchkontrolle.title')}</h4>
		{#if !loading && !loadError && matches.some((m) => m.aktiv)}
			<Button
				color="danger"
				outline
				disabled={freigebend !== null || beendend}
				onclick={() => (beendenOffen = true)}
			>
				<i class="bi bi-stop-circle-fill me-2"></i>{$_('matchkontrolle.beenden_btn')}
			</Button>
		{/if}
	</div>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError}
		<Alert color="danger">{loadError}</Alert>
	{:else if matches.length === 0}
		<p class="text-muted">{$_('matchkontrolle.empty')}</p>
	{:else}
		<Row>
			{#each matches as match (match.id)}
				<Col md={4} sm={6} class="mb-3">
					<Card class="shadow-sm h-100">
						<CardHeader class="text-center">
							<div class="fw-bold">
								{$_('matchkontrolle.match_label', { values: { n: match.nummer } })}
							</div>
						</CardHeader>
						<CardBody class="p-3 text-center d-flex flex-column align-items-center gap-2">
							<Badge color={match.aktiv ? 'success' : 'warning'} class="px-3 py-2 fs-6">
								{match.aktiv ? $_('matchkontrolle.aktiv') : $_('matchkontrolle.inaktiv')}
							</Badge>
							{#if match.aktiv}
								<div class="d-flex flex-wrap justify-content-center gap-2 mt-1">
									{#each match.begegnungen as begegnung (begegnung.scheibe_a)}
										{@const status = paarStatus(begegnung)}
										{@const abweichung = satzAbweichung(begegnung)}
										<Badge
											color={abweichung
												? 'danger'
												: status?.matchComplete
													? 'success'
													: status
														? 'primary'
														: 'secondary'}
											class="fw-normal"
										>
											{$_('matchkontrolle.scheiben_label', {
												values: { a: begegnung.scheibe_a, b: begegnung.scheibe_b }
											})}:
											{#if abweichung}
												{$_('matchkontrolle.satz_abweichung', {
													values: { a: abweichung[0], b: abweichung[1] }
												})}
											{:else if status?.matchComplete}
												{$_('matchkontrolle.abgeschlossen')}
											{:else if status}
												{$_('matchkontrolle.laeuft', { values: { satz: status.currentSetNo } })}
											{:else}
												–
											{/if}
										</Badge>
									{/each}
								</div>
							{/if}
						</CardBody>
						<CardFooter class="d-flex flex-column gap-2">
							<Button
								color="secondary"
								outline
								size="sm"
								href={resolve('/veranstaltungen/[id]/matchkontrolle/[roundNo]', {
									id: veranstaltungId,
									roundNo: String(match.nummer)
								})}
							>
								<i class="bi bi-pencil-square me-2"></i>{$_('matchkontrolle.korrigieren_btn')}
							</Button>
							{#if !match.aktiv}
								<Button
									color="success"
									class="w-100"
									disabled={freigebend !== null || beendend}
									onclick={() => freigeben(match)}
								>
									{#if freigebend === match.id}
										<Spinner size="sm" class="me-2" />
									{:else}
										<i class="bi bi-play-circle-fill me-2"></i>
									{/if}
									{$_('matchkontrolle.freigeben_btn')}
								</Button>
							{/if}
						</CardFooter>
					</Card>
				</Col>
			{/each}
		</Row>
	{/if}
</Container>

<Modal isOpen={beendenOffen} toggle={() => !beendend && (beendenOffen = false)}>
	<ModalHeader toggle={() => !beendend && (beendenOffen = false)}>
		{$_('matchkontrolle.beenden_title')}
	</ModalHeader>
	<ModalBody>{$_('matchkontrolle.beenden_text')}</ModalBody>
	<ModalFooter>
		<Button color="secondary" outline disabled={beendend} onclick={() => (beendenOffen = false)}>
			{$_('matchkontrolle.beenden_cancel')}
		</Button>
		<Button color="danger" disabled={beendend} onclick={beenden}>
			{#if beendend}<Spinner size="sm" class="me-2" />{/if}
			{$_('matchkontrolle.beenden_confirm')}
		</Button>
	</ModalFooter>
</Modal>
