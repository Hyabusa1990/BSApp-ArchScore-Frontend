const FAILURE_THRESHOLD = 3;

/**
 * Generischer "Verbindungsprobleme"-Hinweis für die beiden unabhängig pollenden Server-Loops
 * (Spotter-Tablet, Display, je alle 3s) — siehe Issue #20. Kein Fehler-Typ, kein Retry, nur ein
 * Zähler aufeinanderfolgender Fehlschläge mit fester Toleranz (2-3 Fehlschläge laut Anforderung),
 * damit ein einzelner transienter Hänger nicht sofort den Banner auslöst.
 *
 * Ein einziger Singleton für beide Routen (wie `auth`/`AuthStore`) ist hier bewusst in Ordnung:
 * Tablet und Display sind laut FACHLICHKEIT.md immer getrennte physische Geräte, laufen also nie
 * im selben Browser-Tab gleichzeitig — die States würden sich sonst vermischen.
 */
class ConnectivityStore {
	#consecutiveFailures = $state(0);
	isOffline = $state(false);

	reportSuccess() {
		this.#consecutiveFailures = 0;
		this.isOffline = false;
	}

	reportFailure() {
		this.#consecutiveFailures += 1;
		if (this.#consecutiveFailures >= FAILURE_THRESHOLD) {
			this.isOffline = true;
		}
	}
}

export const connectivity = new ConnectivityStore();
