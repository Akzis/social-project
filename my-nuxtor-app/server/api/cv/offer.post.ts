interface CvOfferPayload {
	sdp?: string
	type?: "offer"
}

interface CvAnswerPayload {
	sdp: string
	type: "answer"
}

interface CvRuntimeConfig {
	cvBaseUrl?: string
}

function normalizeBaseUrl(raw: unknown): string {
	return String(raw || "").trim().replace(/\/+$/, "");
}

function extractErrorMessage(error: unknown): string {
	const maybeError = error as {
		data?: {
			detail?: string
			error?: {
				message?: string
			}
		}
		message?: string
	};

	return String(
		maybeError?.data?.error?.message
		|| maybeError?.data?.detail
		|| maybeError?.message
		|| "Unknown CV service error"
	);
}

export default defineEventHandler(async (event) => {
	const payload = await readBody<CvOfferPayload>(event);
	const sdp = String(payload?.sdp || "").trim();
	const type = payload?.type;

	if (!sdp || type !== "offer") {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid WebRTC offer payload"
		});
	}

	const runtimeConfig = useRuntimeConfig(event) as CvRuntimeConfig;
	const cvBaseUrl = normalizeBaseUrl(runtimeConfig.cvBaseUrl);
	if (!cvBaseUrl) {
		throw createError({
			statusCode: 503,
			statusMessage: "CV service is not configured (NUXT_CV_BASE_URL is empty)"
		});
	}

	try {
		return await $fetch<CvAnswerPayload>(`${cvBaseUrl}/offer`, {
			method: "POST",
			body: {
				sdp,
				type
			}
		});
	} catch (error) {
		throw createError({
			statusCode: 502,
			statusMessage: "Failed to call CV offer endpoint",
			data: {
				reason: extractErrorMessage(error)
			}
		});
	}
});
