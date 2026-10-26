<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { veranstaltungApi } from '$lib/api/veranstaltung';
	import { matchkontrolleApi, type RoundTarget } from '$lib/api/matchkontrolle';
	import { Container, Alert, Button, Spinner, Table } from '@sveltestrap/sveltestrap';

	const SAETZE = [1, 2, 3, 4, 5];

	let { data } = $props<{ data: { id: string; roundNo: number } }>();
	const veranstaltungId = $derived(data.id);

	let fixtureId = $state<number | null>(null);
	let targets = $state<RoundTarget[]>([]);
	// Eingaben als Text, Schlüssel "targetNo-setNo" — erst der Speichern-Button schickt sie ab.
	let entwurf = $state<Record<string, string | number | null>>({});
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saving = $state(false);
	let savedCount = $state<number | null>(null);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	function zellKey(targetNo: number, setNo: number) {
		return `${targetNo}-${setNo}`;
	}

	function serverWert(target: RoundTarget, setNo: number): number | null {
		return target.setScores?.[setNo - 1] ?? null;
	}

	async function ladeRunde() {
		const round = await matchkontrolleApi.getRound(auth.accessToken!, fixtureId!, data.roundNo);
		targets = [...(round.targets ?? [])].sort((a, b) => a.targetNo - b.targetNo);
		entwurf = Object.fromEntries(
			targets.flatMap((t) =>
				SAETZE.map((n) => [zellKey(t.targetNo, n), String(serverWert(t, n) ?? '')])
			)
		);
	}

	async function load() {
		loading = true;
		loadError = null;
		try {
			const v = await veranstaltungApi.get(auth.accessToken!, Number(veranstaltungId));
			fixtureId = v.id;
			await ladeRunde();
		} catch {
			loadError = $_('matchkontrolle.korrektur_error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	// `bind:value` auf type="number" liefert eine Zahl (leer: null), initial steht ein String drin.
	function parse(value: string | number | null | undefined): number | null | undefined {
		const raw = String(value ?? '').trim();
		if (raw === '') return null;
		const n = Number(raw);
		return Number.isInteger(n) && n >= 0 ? n : undefined; // undefined = ungültig
	}

	function istGeaendert(target: RoundTarget, setNo: number): boolean {
		const neu = parse(entwurf[zellKey(target.targetNo, setNo)]);
		return neu === undefined || neu !== serverWert(target, setNo);
	}

	function istUngueltig(target: RoundTarget, setNo: number): boolean {
		return parse(entwurf[zellKey(target.targetNo, setNo)]) === undefined;
	}

	const aenderungen = $derived(
		targets.flatMap((t) => SAETZE.filter((n) => istGeaendert(t, n)).map((n) => ({ t, n })))
	);
	const hatUngueltige = $derived(targets.some((t) => SAETZE.some((n) => istUngueltig(t, n))));

	async function speichern() {
		if (saving || aenderungen.length === 0 || hatUngueltige) return;
		saving = true;
		saveError = null;
		savedCount = null;
		let gespeichert = 0;
		try {
			for (const { t, n } of aenderungen) {
				await matchkontrolleApi.setSetScore(
					auth.accessToken!,
					fixtureId!,
					data.roundNo,
					t.targetNo,
					n,
					parse(entwurf[zellKey(t.targetNo, n)]) as number | null
				);
				gespeichert++;
			}
			savedCount = gespeichert;
		} catch {
			saveError = $_('matchkontrolle.korrektur_error_save');
		} finally {
			saving = false;
			// Satzpunkte berechnet das Backend — immer den Serverstand übernehmen.
			try {
				await ladeRunde();
			} catch {
				loadError = $_('matchkontrolle.korrektur_error_load');
			}
		}
	}

	function verwerfen() {
		saveError = null;
		savedCount = null;
		entwurf = Object.fromEntries(
			targets.flatMap((t) =>
				SAETZE.map((n) => [zellKey(t.targetNo, n), String(serverWert(t, n) ?? '')])
			)
		);
	}
</script>

<svelte:head>
	<title>{$_('matchkontrolle.korrigieren_btn')}</title>
</svelte:head>

<Container class="py-4">
	<a
		href={resolve('/veranstaltungen/[id]/matchkontrolle', { id: veranstaltungId })}
		class="d-inline-block mb-3 text-decoration-none small"
	>
		&larr; {$_('matchkontrolle.korrektur_back')}
	</a>

	<h4 class="mb-2">
		{$_('matchkontrolle.korrektur_title', { values: { n: data.roundNo } })}
	</h4>
	<p class="text-muted small mb-4">{$_('matchkontrolle.korrektur_hint')}</p>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError}
		<Alert color="danger">{loadError}</Alert>
	{:else}
		{#if saveError}
			<Alert color="danger">{saveError}</Alert>
		{/if}
		<div class="table-responsive">
			<Table bordered class="align-middle text-center">
				<thead>
					<tr>
						<th class="text-start">{$_('matchkontrolle.korrektur_team')}</th>
						<th>{$_('matchkontrolle.korrektur_scheibe')}</th>
						{#each SAETZE as n (n)}
							<th>{$_('matchkontrolle.korrektur_satz', { values: { n } })}</th>
						{/each}
						<th>{$_('matchkontrolle.korrektur_satzpunkte')}</th>
					</tr>
				</thead>
				<tbody>
					{#each targets as target (target.targetNo)}
						<tr>
							<td class="text-start fw-bold">{target.teamName}</td>
							<td>{target.targetNo}</td>
							{#each SAETZE as setNo (setNo)}
								{@const key = zellKey(target.targetNo, setNo)}
								<td class="p-1">
									<input
										type="number"
										min="0"
										inputmode="numeric"
										class="form-control text-center {istUngueltig(target, setNo)
											? 'is-invalid'
											: istGeaendert(target, setNo)
												? 'border-warning bg-warning-subtle'
												: ''}"
										style="min-width: 5rem;"
										bind:value={entwurf[key]}
										disabled={saving}
										onkeydown={(e) => e.key === 'Enter' && speichern()}
									/>
								</td>
							{/each}
							<td class="fw-bold">{target.totalSetPoints}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</div>
		{#if savedCount !== null && !saveError}
			<Alert color="success">
				{$_('matchkontrolle.korrektur_saved', { values: { n: savedCount } })}
			</Alert>
		{/if}
		<div class="d-flex gap-2 justify-content-end">
			<Button
				color="secondary"
				outline
				disabled={saving || aenderungen.length === 0}
				onclick={verwerfen}
			>
				{$_('matchkontrolle.korrektur_verwerfen_btn')}
			</Button>
			<Button
				color="primary"
				disabled={saving || aenderungen.length === 0 || hatUngueltige}
				onclick={speichern}
			>
				{#if saving}
					<Spinner size="sm" class="me-2" />
				{:else}
					<i class="bi bi-save me-2"></i>
				{/if}
				{$_('matchkontrolle.korrektur_speichern_btn')}
				{#if aenderungen.length > 0}({aenderungen.length}){/if}
			</Button>
		</div>
	{/if}
</Container>
