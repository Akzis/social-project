import { claimWaitingSession } from "../../../utils/callStore";

export default defineEventHandler(() => {
	const session = claimWaitingSession();

	if (!session) {
		return {
			found: false
		};
	}

	return {
		found: true,
		sessionId: session.id,
		status: session.status,
		matchedAt: session.matchedAt,
		blindProfileId: session.blindProfileId,
		blindName: session.blindName
	};
});
