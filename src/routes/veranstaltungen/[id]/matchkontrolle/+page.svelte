<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { veranstaltungApi, type Veranstaltung } from '$lib/api/veranstaltung';
	import { matchkontrolleApi, type Match, type ConfirmStatus } from '$lib/api/matchkontrolle';
	import {
		Container,
		Card,
		CardBody,
		Row,
		Col,
		Badge,
		Alert,
		Spinner
	} from '@sveltestrap/sveltestrap';

	let { data } = $props<{ data: { id: string } }>();
	const veranstaltungId = $derived(data.id);

	let veranstaltung = $state<Veranstaltung | null>(null);
	let matches = $state<Match[]>([]);
	let confirmStatus = $state<ConfirmStatus>({});
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	// Match-ID, deren Freigabe-Anfrage gerade läuft — verhindert Doppelklicks/Parallel-Freigaben.
	let freigebend = $state<string | null>(null);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	function scheibenFuer(match: Match): number[] {
		return match.begegnungen.flatMap((b) => [b.scheibe_a, b.scheibe_b]);
	}

	// Confirm-Status kommt aus keinem eigenen Matchkontrolle-Endpunkt (Fawkes kennt keinen),
	// sondern pro Scheibe des aktiven Matches über denselben Spotter-Info-Call wie die
	// Binocular-Seite selbst — siehe matchkontrolle.ts.
	async function ladeConfirmStatus() {
		if (!veranstaltung) return;
		const aktivesMatch = matches.find((m) => m.aktiv);
		confirmStatus = aktivesMatch
			? await matchkontrolleApi.getConfirmStatus(veranstaltung.uniqueId, scheibenFuer(aktivesMatch))
			: {};
	}

	async function load() {
		loading = true;
		loadError = null;
		try {
			const [v, ms] = await Promise.all([
				veranstaltungApi.get(auth.accessToken!, Number(veranstaltungId)),
				matchkontrolleApi.list(auth.accessToken!, veranstaltungId)
			]);
			veranstaltung = v;
			const phase = await matchkontrolleApi.getPhase(auth.accessToken!, v.id);
			matches = ms.map((m) => ({ ...m, aktiv: m.nummer === phase.roundNo }));
			await ladeConfirmStatus();
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
		const interval = setInterval(ladeConfirmStatus, 3000);
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
			await ladeConfirmStatus();
		} catch {
			loadError = $_('matchkontrolle.error_freigeben');
			matches = vorherigeMatches; // Optimistischen Stand verwerfen
		} finally {
			freigebend = null;
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

	<h4 class="mb-4">{$_('matchkontrolle.title')}</h4>

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
						<CardBody class="p-3 text-center d-flex flex-column align-items-center gap-2">
							<div class="fw-bold">
								{$_('matchkontrolle.match_label', { values: { n: match.nummer } })}
							</div>
							<Badge color={match.aktiv ? 'success' : 'warning'} class="px-3 py-2 fs-6">
								{match.aktiv ? $_('matchkontrolle.aktiv') : $_('matchkontrolle.inaktiv')}
							</Badge>
							{#if match.aktiv}
								<div class="d-flex flex-wrap justify-content-center gap-2 mt-1">
									{#each scheibenFuer(match) as scheibe (scheibe)}
										<Badge
											color={confirmStatus[scheibe] ? 'success' : 'secondary'}
											class="fw-normal"
										>
											{$_('matchkontrolle.scheibe_label', { values: { n: scheibe } })}:
											{confirmStatus[scheibe]
												? $_('matchkontrolle.bestaetigt')
												: $_('matchkontrolle.ausstehend')}
										</Badge>
									{/each}
								</div>
							{:else}
								<button
									type="button"
									class="btn btn-sm btn-link text-success text-decoration-none"
									disabled={freigebend !== null}
									onclick={() => freigeben(match)}
								>
									{#if freigebend === match.id}
										<Spinner size="sm" class="me-1" />
									{/if}
									{$_('matchkontrolle.freigeben_btn')}
								</button>
							{/if}
						</CardBody>
					</Card>
				</Col>
			{/each}
		</Row>
	{/if}
</Container>
