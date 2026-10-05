import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	fixtureUniqueId: params.fixtureUniqueId,
	scheibennummer: Number(params.scheibennummer)
});
