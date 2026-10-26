import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	id: params.id,
	roundNo: Number(params.roundNo)
});
