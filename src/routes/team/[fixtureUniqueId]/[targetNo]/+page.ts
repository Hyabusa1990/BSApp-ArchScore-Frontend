import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	fixtureUniqueId: params.fixtureUniqueId,
	targetNo: Number(params.targetNo)
});
