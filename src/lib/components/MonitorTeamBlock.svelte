<script lang="ts">
	import { deriveMonitorStatus, type DisplaySeite } from '$lib/api/display';
	import { decodeShot } from '$lib/api/binocular';
	import { _ } from 'svelte-i18n';

	let {
		seite,
		rechtsOrientiert = false,
		satzpunkteFuehrt = false,
		satzpunkteZurueck = false,
		gegnerSetScores = null
	} = $props<{
		seite: DisplaySeite;
		rechtsOrientiert?: boolean;
		satzpunkteFuehrt?: boolean;
		satzpunkteZurueck?: boolean;
		/** setScores der gegnerischen Seite, für den Positionsvergleich in ZWISCHEN_SAETZEN
		 * (siehe Issue #16) — von +page.svelte durchgereicht. */
		gegnerSetScores?: number[] | null;
	}>();

	const status = $derived(deriveMonitorStatus(seite));

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

	// Vergleich mit demselben Satz der gegnerischen Mannschaft (gleiche Index-Position) —
	// eigener Wert höher = grün (führt), niedriger = rot (liegt zurück), gleich = hellgrau.
	function vergleichsKlasse(eigen: number, gegner: number | null | undefined): string {
		if (gegner == null) return 'punkte-gleich';
		if (eigen > gegner) return 'punkte-fuehrend';
		if (eigen < gegner) return 'punkte-rueckstand';
		return 'punkte-gleich';
	}

	type AnzeigeWert = { label: string; colorClass: string };

	// Pfeilwerte des laufenden Satzes, aus dem shots-String geparst (gleiche Dekodierung wie
	// beim Spotter, siehe #9) — wächst von links nach rechts mit jedem Treffer, keine
	// Platzhalter für noch nicht geschossene Pfeile (bewusst reduziert für die
	// Zuschauer-Anzeige aus der Distanz).
	const shotsWerte = $derived<AnzeigeWert[]>(
		status === 'SATZ_LAEUFT' && seite.shots
			? seite.shots.split('').map((zeichen: string) => {
					const ringzahl = decodeShot(zeichen);
					return { label: ringLabel(ringzahl), colorClass: ringColorClass(ringzahl) };
				})
			: []
	);

	// Ein Kästchen pro abgeschlossenem Satz, farblich gegen die gegnerische Mannschaft an
	// derselben Index-Position verglichen.
	const setScoreWerte = $derived<AnzeigeWert[]>(
		status === 'ZWISCHEN_SAETZEN' && seite.setScores
			? seite.setScores.map((wert: number, i: number) => ({
					label: String(wert),
					colorClass: vergleichsKlasse(wert, gegnerSetScores?.[i])
				}))
			: []
	);

	const boxWerte = $derived<AnzeigeWert[]>(
		status === 'SATZ_LAEUFT' ? shotsWerte : status === 'ZWISCHEN_SAETZEN' ? setScoreWerte : []
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
	// Schrift bleibt immer proportional zum tatsächlichen Kästchen. Gilt gleichermaßen für
	// die setScores-Boxen in ZWISCHEN_SAETZEN — dieselbe Größenberechnung, andere Werte.
	let arrowsWidth = $state(0);
	let arrowsHeight = $state(0);
	const ARROW_GAP_PX = 8;
	const arrowSizePx = $derived.by(() => {
		const n = boxWerte.length;
		if (n === 0 || arrowsWidth <= 0 || arrowsHeight <= 0) return 0;
		const breitePerPfeil = (arrowsWidth - ARROW_GAP_PX * (n - 1)) / n;
		return Math.max(0, Math.min(arrowsHeight, breitePerPfeil));
	});
</script>

<div class="monitor-block">
	<div class="monitor-header {rechtsOrientiert ? 'monitor-header-rechts' : ''}">
		<span class="monitor-badge">{seite.targetNo ?? '–'}</span>
		<span class="monitor-team-name">{seite.teamName ?? $_('display.no_team')}</span>
	</div>

	{#if status === 'VOR_DEM_MATCH'}
		{#if seite.shooters && seite.shooters.length > 0}
			<div class="monitor-schuetzen-grid">
				{#each seite.shooters as name (name)}
					<div class="monitor-schuetze-chip">{name}</div>
				{/each}
			</div>
		{:else}
			<div class="monitor-center-content">
				<div class="monitor-placeholder">⏳</div>
				<div class="monitor-status-label">{$_('display.status_wartet')}</div>
			</div>
		{/if}
	{:else}
		<div class="monitor-satz-row">
			<div class="monitor-arrows" bind:clientWidth={arrowsWidth} bind:clientHeight={arrowsHeight}>
				{#each boxWerte as wert, i (i)}
					<div
						class="monitor-arrow {wert.colorClass}"
						style="width: {arrowSizePx}px; height: {arrowSizePx}px; font-size: {arrowSizePx *
							0.5}px;"
					>
						{wert.label}
					</div>
				{/each}
			</div>
			<div class="monitor-boxes">
				{#if status === 'SATZ_LAEUFT'}
					<div class="monitor-box monitor-box-neutral">{seite.currentSetScore ?? 0}</div>
				{/if}
				{#if seite.setPoints !== null}
					<div class="monitor-box monitor-box-punkte {satzpunkteBoxClass}">
						{seite.setPoints}
					</div>
				{/if}
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
		background: var(--monitor-elevated);
		color: var(--monitor-elevated-fg);
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
		color: var(--monitor-muted);
	}

	.monitor-schuetzen-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(0.75rem, 1.5vw, 1.5rem);
		align-content: stretch;
	}

	.monitor-schuetze-chip {
		background: var(--monitor-chip-bg);
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
		background: var(--monitor-elevated);
		color: var(--monitor-elevated-fg);
	}

	.monitor-box-punkte {
		background: var(--monitor-points-bg);
		color: var(--monitor-points-fg);
	}

	/* Führend/Rückstand bleiben in beiden Themes gleich — Ampelfarben lesen auf hell wie dunkel. */
	.punkte-fuehrend {
		background: #2f9e4f;
		color: #fff;
	}

	.punkte-rueckstand {
		background: #c8304a;
		color: #fff;
	}

	/* Gleichstand im setScores-Vergleich (ZWISCHEN_SAETZEN) — neutrales Grau statt der
	   Elevated-Farbe, damit "gleich" optisch klar von "noch kein Vergleich möglich"
	   unterscheidbar bleibt. */
	.punkte-gleich {
		background: var(--monitor-compare-equal-bg);
		color: var(--monitor-compare-equal-fg);
	}

	.ring-leer {
		color: var(--monitor-ring-empty-fg);
		background: var(--monitor-ring-empty-bg);
	}
	/* Klassische Zielscheiben-Farben (gelb/rot/blau/schwarz/weiß/grün-Fehler) — bewusst in beiden
	   Themes identisch, das sind Ring-Farben, keine UI-Farben. Schwarz UND Weiß bekommen immer
	   einen Rand: Schwarz braucht ihn auf dunklem Grund, Weiß auf hellem — beide Fälle decken. */
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
		border: 1px solid var(--monitor-border);
	}
	.ring-weiss {
		background: #fff;
		color: #000;
		border: 1px solid var(--monitor-border);
	}
</style>
