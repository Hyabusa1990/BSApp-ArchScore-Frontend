<script lang="ts">
	import type { Snippet } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { Role } from '$lib/api/auth';

	interface Props {
		/** Erlaubte Rolle(n). Ohne Angabe: nur eingeloggt sein reicht. */
		role?: Role | Role[];
		children: Snippet;
		fallback?: Snippet;
	}

	let { role, children, fallback }: Props = $props();

	const allowedRoles = $derived(role === undefined ? undefined : ([] as Role[]).concat(role));

	const allowed = $derived(
		auth.initialized && !!auth.user && (!allowedRoles || allowedRoles.includes(auth.user.role))
	);
</script>

{#if allowed}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
