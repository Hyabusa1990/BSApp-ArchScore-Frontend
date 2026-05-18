<script lang="ts">
	import { FormGroup, Label, InputGroup, InputGroupText, Icon } from '@sveltestrap/sveltestrap';

	interface Props {
		id: string;
		label: string;
		type?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		autocomplete?: string;
		icon?: string;
	}

	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		required = false,
		autocomplete = '',
		icon = ''
	}: Props = $props();
</script>

<FormGroup>
	<Label for={id}>{label}</Label>
	{#if icon}
		<InputGroup>
			<InputGroupText><Icon name={icon} /></InputGroupText>
			<input
				{id}
				{type}
				bind:value
				{placeholder}
				{required}
				autocomplete={autocomplete as HTMLInputElement['autocomplete']}
				class="form-control"
			/>
		</InputGroup>
	{:else}
		<input
			{id}
			{type}
			bind:value
			{placeholder}
			{required}
			autocomplete={autocomplete as HTMLInputElement['autocomplete']}
			class="form-control"
		/>
	{/if}
</FormGroup>