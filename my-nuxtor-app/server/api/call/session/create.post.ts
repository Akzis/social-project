import { createCallSession } from "../../../utils/callStore";

interface CreateSessionBody {
	blindProfileId?: number | null
	blindName?: string
}

export default defineEventHandler(async (event) => {
	const body = await readBody<CreateSessionBody>(event);
	const session = createCallSession({
		blindProfileId: body?.blindProfileId,
		blindName: body?.blindName
	});

	return {
		sessionId: session.id,
		status: session.status,
		createdAt: session.createdAt,
		blindProfileId: session.blindProfileId,
		blindName: session.blindName
	};
});
