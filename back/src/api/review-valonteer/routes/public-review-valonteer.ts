export default {
	routes: [
		{
			method: "POST",
			path: "/review-valonteers/public-submit",
			handler: "review-valonteer.createPublic",
			config: {
				auth: false
			}
		}
	]
};

