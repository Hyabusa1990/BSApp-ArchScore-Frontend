<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Container, Row, Col, Card, CardBody } from '@sveltestrap/sveltestrap';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="auth-page">
	<Container>
		<Row class="justify-content-center">
			<Col xs={12} sm={10} md={7} lg={5} xl={4}>
				<Card class="shadow-sm">
					<CardBody class="p-4">
						<h4 class="mb-4">{title}</h4>
						{@render children()}
					</CardBody>
				</Card>
			</Col>
		</Row>
	</Container>
</div>

<style>
	.auth-page {
		display: flex;
		align-items: center;
		min-height: calc(100vh - 56px);
		background: #f8fafc;
		padding: 1rem 0;
	}
</style>
