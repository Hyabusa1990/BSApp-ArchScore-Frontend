<script lang="ts">
	import type { Snippet } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';

	interface Props {
		permission?: string;
		group?: string;
		children: Snippet;
		fallback?: Snippet;
	}

	let { permission, group, children, fallback }: Props = $props();

	const allowed = $derived(
		auth.initialized &&
			(!permission || auth.hasPermission(permission)) &&
			(!group || auth.hasGroup(group))
	);
</script>

{#if allowed}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}