/**
 * UUID v4 für die Fake-API. `crypto.randomUUID()` gibt es nur in Secure Contexts (HTTPS oder
 * `localhost`) — ruft man den Dev-Server über die LAN-IP auf (z. B. Tablet/Display im Netz), ist
 * es `undefined` und jeder Handler, der Tokens/IDs erzeugt, wirft (Login schlägt fehl).
 * `crypto.getRandomValues()` ist dagegen auch ohne Secure Context verfügbar.
 */
export function randomUUID(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
