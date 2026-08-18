<script lang="ts">
	import type { LigaTableEintrag } from '$lib/api/display';
	import { _ } from 'svelte-i18n';

	let { eintraege } = $props<{ eintraege: LigaTableEintrag[] }>();

	// Schriftgröße dynamisch aus der gemessenen Container-Höhe berechnen (ResizeObserver),
	// NICHT über statisches CSS clamp()/vh — Vorbild: liga-Referenzprojekt (beamer-Route).
	// Damit füllt die Tabelle immer die verfügbare Höhe, egal wie viele Mannschaften.
	let mainEl = $state<HTMLElement | null>(null);
	let fontSize = $state('1.5rem');

	// Server liefert `position` explizit (nicht mehr aus der Array-Reihenfolge abgeleitet, siehe
	// Issue #18) — defensiv sortieren statt Server-Reihenfolge blind zu vertrauen.
	const sortiert = $derived([...eintraege].sort((a, b) => a.position - b.position));

	$effect(() => {
		if (!mainEl || sortiert.length === 0) return;
		const berechneFontSize = () => {
			const h = mainEl!.clientHeight;
			const fs = Math.floor((h / (sortiert.length + 1.5)) * 0.58);
			fontSize = `${Math.max(14, fs)}px`;
		};
		berechneFontSize();
		const ro = new ResizeObserver(berechneFontSize);
		ro.observe(mainEl);
		return () => ro.disconnect();
	});
</script>

<div class="tabelle-page" bind:this={mainEl}>
	{#if sortiert.length === 0}
		<p class="tabelle-status">{$_('display.tabelle_empty')}</p>
	{:else}
		<table class="tabelle" style="font-size: {fontSize}">
			<thead>
				<tr>
					<th class="col-pos">{$_('display.tabelle_pos')}</th>
					<th class="col-mannschaft">{$_('display.tabelle_mannschaft')}</th>
					<th class="col-mp">{$_('display.tabelle_mp')}</th>
					<th class="col-sp">{$_('display.tabelle_sp')}</th>
				</tr>
			</thead>
			<tbody>
				{#each sortiert as eintrag, i (eintrag.position)}
					{@const spNetto = eintrag.setPlus - eintrag.setMinus}
					<tr class:even={i % 2 === 1}>
						<td class="col-pos">{eintrag.position}</td>
						<td class="col-mannschaft">{eintrag.teamName}</td>
						<td class="col-mp">
							<span class="mp-value">{eintrag.matchPlus}</span>
							<span class="mp-detail">({eintrag.matchPlus}:{eintrag.matchMinus})</span>
						</td>
						<td class="col-sp" class:positive={spNetto >= 0} class:negative={spNetto < 0}>
							{spNetto >= 0 ? '+' : ''}{spNetto}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.tabelle-page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(1rem, 3vh, 3rem) clamp(1rem, 3vw, 3rem);
		box-sizing: border-box;
	}

	.tabelle-status {
		text-align: center;
		font-size: 1.5rem;
		color: var(--monitor-muted);
	}

	.tabelle {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		color: var(--monitor-fg);
		/* font-size wird per inline-style gesetzt */
	}

	.tabelle thead tr {
		border-bottom: 2px solid var(--monitor-divider-line);
	}

	.tabelle thead th {
		font-size: 0.55em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--monitor-muted);
		padding: 0.3em 0.6rem;
	}

	.tabelle tbody tr {
		border-bottom: 1px solid var(--monitor-row-border);
		line-height: 1.4;
	}

	.tabelle tbody tr.even {
		background: var(--monitor-row-even);
	}

	.tabelle tbody td {
		padding: 0.25em 0.6rem;
		vertical-align: middle;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.col-pos {
		width: 7%;
		text-align: center;
		font-weight: 700;
		color: var(--monitor-muted);
	}
	.col-mannschaft {
		text-align: left;
		font-weight: 600;
	}
	.col-mp {
		width: 20%;
		text-align: right;
	}
	.col-sp {
		width: 12%;
		text-align: right;
		font-weight: 700;
	}

	.mp-value {
		font-weight: 700;
	}
	.mp-detail {
		font-size: 0.65em;
		color: var(--monitor-muted);
		margin-left: 0.3rem;
	}

	/* Bleiben in beiden Themes gleich — Ampelfarben lesen auf hell wie dunkel. */
	.col-sp.positive {
		color: #2f9e4f;
	}
	.col-sp.negative {
		color: #c8304a;
	}
</style>
