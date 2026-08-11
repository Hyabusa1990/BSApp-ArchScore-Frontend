<script lang="ts">
	import type { DisplayPfeil, DisplaySeite } from '$lib/api/display';
	import { _ } from 'svelte-i18n';

	let {
		seite,
		rechtsOrientiert = false,
		satzpunkteFuehrt = false,
		satzpunkteZurueck = false
	} = $props<{
		seite: DisplaySeite;
		rechtsOrientiert?: boolean;
		satzpunkteFuehrt?: boolean;
		satzpunkteZurueck?: boolean;
	}>();

	// Zielscheiben-Farbschema: 10-9 gelb, 8-7 rot, 6-5 blau, 4-3 schwarz, 2-1 weiß, M grün.
	function ringColorClass(val: number | null): string {
		if (val === null) return 'ring-leer';
		if (val === 0) return 'ring-gruen';
		if (val >= 9) return 'ring-gelb';
		if (val >= 7) return 'ring-rot';
		if (val >= 5) return 'ring-blau';
		if (val >= 3) return 'ring-schwarz';
		return 'ring-weiss';
	}

	function ringLabel(val: number | null): string {
		if (val === null) return '–';
		return val === 0 ? 'M' : String(val);
	}

	// Flache Liste aller bereits erfassten Pfeile des offenen Satzes in Schussreihenfolge —
	// wächst von links nach rechts mit jedem Treffer, keine Platzhalter für noch nicht
	// geschossene Pfeile (bewusst reduziert für die Zuschauer-Anzeige aus der Distanz).
	const pfeilWerte = $derived(
		seite.pfeile
			.flatMap((p: DisplayPfeil) => [p.ringzahl_pfeil1, p.ringzahl_pfeil2])
			.filter((v: number | null) => v !== null)
	) as number[];

	// Ringsumme des aktuell laufenden ODER gerade beendeten Satzes — der letzte Eintrag in
	// satz_ergebnisse ist für beide Fälle maßgeblich.
	const ringSummeSatz = $derived(
		seite.satz_ergebnisse.length > 0
			? seite.satz_ergebnisse[seite.satz_ergebnisse.length - 1].eigene_ringe
			: 0
	);

	const satzpunkteBoxClass = $derived(
		satzpunkteFuehrt ? 'punkte-fuehrend' : satzpunkteZurueck ? 'punkte-rueckstand' : ''
	);

	// Pfeilgröße wird in JS aus der tatsächlich gemessenen Breite/Höhe des Containers
	// berechnet, NICHT über CSS aspect-ratio + flex-shrink + Container-Queries — diese
	// Kombination löst in Chromium einen Layout-Bug aus (Höhe folgt nicht der Breite,
	// die Zeile bläht sich auf ein Vielfaches der verfügbaren Höhe auf; reproduziert bei
	// 720p/FullHD mit 5-6 Pfeilen). Die pixelgenaue JS-Berechnung ist zwar weniger elegant,
	// aber deterministisch: Pfeile passen garantiert in eine Zeile (nie Umbruch) und ihre
	// Schrift bleibt immer proportional zum tatsächlichen Kästchen.
	let arrowsWidth = $state(0);
	let arrowsHeight = $state(0);
	const ARROW_GAP_PX = 8;
	const arrowSizePx = $derived.by(() => {
		const n = pfeilWerte.length;
		if (n === 0 || arrowsWidth <= 0 || arrowsHeight <= 0) return 0;
		const breitePerPfeil = (arrowsWidth - ARROW_GAP_PX * (n - 1)) / n;
		return Math.max(0, Math.min(arrowsHeight, breitePerPfeil));
	});
</script>

<div class="monitor-block">
	<div class="monitor-header {rechtsOrientiert ? 'monitor-header-rechts' : ''}">
		<span class="monitor-badge">{seite.scheibennummer ?? '–'}</span>
		<span class="monitor-team-name">{seite.mannschaft_name ?? $_('display.no_team')}</span>
	</div>

	{#if seite.monitor_status === 'WARTET'}
		<div class="monitor-center-content">
			<div class="monitor-placeholder">⏳</div>
			<div class="monitor-status-label">{$_('display.status_wartet')}</div>
		</div>
	{:else if seite.monitor_status === 'SCHUETZEN_GEMELDET'}
		<div class="monitor-schuetzen-grid">
			{#each seite.schuetzen as name (name)}
				<div class="monitor-schuetze-chip">{name}</div>
			{/each}
		</div>
	{:else if seite.monitor_status === 'SATZ_LAEUFT' || seite.monitor_status === 'SATZ_FERTIG'}
		<div class="monitor-satz-row">
			<div class="monitor-arrows" bind:clientWidth={arrowsWidth} bind:clientHeight={arrowsHeight}>
				{#each pfeilWerte as val, i (i)}
					<div
						class="monitor-arrow {ringColorClass(val)}"
						style="width: {arrowSizePx}px; height: {arrowSizePx}px; font-size: {arrowSizePx *
							0.5}px;"
					>
						{ringLabel(val)}
					</div>
				{/each}
			</div>
			<div class="monitor-boxes">
				<div class="monitor-box monitor-box-neutral">{ringSummeSatz}</div>
				{#if seite.monitor_status === 'SATZ_FERTIG' && seite.satzpunkte !== null}
					<div class="monitor-box monitor-box-punkte {satzpunkteBoxClass}">
						{seite.satzpunkte}
					</div>
				{/if}
			</div>
		</div>
	{:else if seite.monitor_status === 'MATCH_FERTIG'}
		<div class="monitor-satz-row">
			<div class="monitor-boxes monitor-boxes-final">
				<div class="monitor-box monitor-box-neutral monitor-box-label">
					{$_('display.status_match_fertig')}
				</div>
				<div class="monitor-box monitor-box-punkte monitor-box-final {satzpunkteBoxClass}">
					{seite.satzpunkte ?? '–'}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Zielgruppe: 42-49" Bildschirme zwischen den Scheiben, 20-30m Leseabstand.
	   Alle Größen bewusst dominant vh-basiert (nicht vw) — die Höhe der beiden
	   gestapelten Team-Blöcke ist die knappe Ressource, und vh skaliert mit der
	   physischen Bildschirmgröße unabhängig von der Auflösung (TVs haben i.d.R.
	   devicePixelRatio 1). Maximalwerte dienen nur als Notbremse nach oben. */
	.monitor-block {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 0.6rem clamp(1rem, 2vw, 2rem);
		gap: clamp(0.4rem, 1vh, 1rem);
		min-height: 0;
	}

	.monitor-header {
		display: flex;
		align-items: center;
		gap: clamp(0.6rem, 1.5vh, 1.5rem);
		flex-shrink: 0;
		min-width: 0;
	}

	/* Untere Mannschaft rechtsbündig, Name vor Scheibennummer-Badge (Bildschirm steht
	   zwischen den Scheiben — jede Mannschaft ist zu "ihrer" Seite hin orientiert). */
	.monitor-header-rechts {
		flex-direction: row-reverse;
		justify-content: flex-start;
	}

	.monitor-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: clamp(3rem, 7.5vh, 6rem);
		height: clamp(3rem, 7.5vh, 6rem);
		background: #2a323d;
		border-radius: 0.4rem;
		font-size: clamp(1.6rem, 4vh, 3.2rem);
		font-weight: 800;
		flex-shrink: 0;
	}

	.monitor-team-name {
		font-size: clamp(3rem, 9vh, 8rem);
		font-weight: 800;
		letter-spacing: 0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.monitor-center-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.monitor-placeholder {
		font-size: clamp(3rem, 12vh, 8rem);
		opacity: 0.5;
	}

	.monitor-status-label {
		font-size: clamp(1.2rem, 3.5vh, 2.5rem);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #9aa4b2;
	}

	.monitor-schuetzen-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(0.75rem, 1.5vw, 1.5rem);
		align-content: stretch;
	}

	.monitor-schuetze-chip {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: clamp(2rem, 8vh, 6.5rem);
		font-weight: 700;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.monitor-satz-row {
		flex: 1;
		display: flex;
		align-items: stretch;
		justify-content: space-between;
		gap: clamp(1rem, 2.5vw, 2.5rem);
		min-width: 0;
		/* Klassischer Flexbox-Fallstrick: ohne min-height:0 darf der Inhalt (aspect-ratio-
		   Pfeile in .monitor-arrows) die Zeile über ihren fairen Anteil hinaus aufblähen,
		   statt sich der zugewiesenen Höhe unterzuordnen — Ursache für den Größen-Bug. */
		min-height: 0;
	}

	.monitor-arrows {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px; /* muss zu ARROW_GAP_PX im Script passen (Platzberechnung) */
		/* NIE umbrechen — bis zu 6 Pfeile pro Satz müssen immer in eine Zeile passen, auch
		   bei 720p/FullHD. Die Größe pro Pfeil wird deshalb in JS aus der gemessenen Breite
		   berechnet statt über CSS zu schrumpfen (siehe arrowSizePx im Script). */
		flex-wrap: nowrap;
		min-width: 0;
	}

	.monitor-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 0.6rem;
		font-weight: 800;
		line-height: 1;
	}

	.monitor-boxes {
		display: flex;
		gap: clamp(0.6rem, 1.2vw, 1.1rem);
		flex-shrink: 0;
		align-self: stretch;
	}

	.monitor-boxes-final {
		flex: 1;
		justify-content: flex-end;
	}

	.monitor-box {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: clamp(6rem, 17vw, 15rem);
		border-radius: 0.6rem;
		font-weight: 800;
		font-size: clamp(3.5rem, 27vh, 15rem);
		padding: 0 1rem;
		line-height: 1;
	}

	.monitor-box-neutral {
		background: #2a323d;
		color: #f5f7fa;
	}

	.monitor-box-label {
		flex: 1;
		font-size: clamp(1.6rem, 6vh, 3.5rem);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.monitor-box-punkte {
		background: #495057;
		color: #fff;
	}

	.monitor-box-final {
		min-width: clamp(7rem, 20vw, 18rem);
		font-size: clamp(4rem, 30vh, 17rem);
	}

	.punkte-fuehrend {
		background: #2f9e4f;
	}

	.punkte-rueckstand {
		background: #c8304a;
	}

	.ring-leer {
		color: #6c757d;
		background: rgba(255, 255, 255, 0.06);
	}
	.ring-gruen {
		background: #198754;
		color: #fff;
	}
	.ring-gelb {
		background: #ffc107;
		color: #000;
	}
	.ring-rot {
		background: #dc3545;
		color: #fff;
	}
	.ring-blau {
		background: #0d6efd;
		color: #fff;
	}
	.ring-schwarz {
		background: #212529;
		color: #fff;
		border: 1px solid #495057;
	}
	.ring-weiss {
		background: #fff;
		color: #000;
	}
</style>
