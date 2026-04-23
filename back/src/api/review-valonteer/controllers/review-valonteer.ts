/**
 * review-valonteer controller
 */

import { factories } from '@strapi/strapi';

function toId(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0;
	}

	return Math.floor(parsed);
}

function normalizeText(value: unknown): string {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function extractRelationRef(raw: unknown): { id: number, documentId: string } {
	if (raw && typeof raw === "object") {
		const record = raw as Record<string, unknown>;
		const connectRaw = Array.isArray(record.connect) ? record.connect[0] : undefined;
		if (connectRaw !== undefined) {
			return extractRelationRef(connectRaw);
		}

		const nestedId = toId(record.id);
		const nestedDocumentId = normalizeText(record.documentId);
		if (nestedId > 0 || nestedDocumentId) {
			return {
				id: nestedId,
				documentId: nestedDocumentId
			};
		}
	}

	const primitiveId = toId(raw);
	if (primitiveId > 0) {
		return {
			id: primitiveId,
			documentId: ""
		};
	}

	return {
		id: 0,
		documentId: normalizeText(raw)
	};
}

export default factories.createCoreController('api::review-valonteer.review-valonteer', ({ strapi }) => ({
	async createPublic(ctx) {
		const payload = (ctx.request.body?.data || ctx.request.body || {}) as Record<string, unknown>;
		const text = normalizeText(payload.text).slice(0, 1000);

		if (!text) {
			return ctx.badRequest("Review text is required.");
		}

		const relationPayload = payload.volunteer_profile ?? payload.volunteerProfile ?? payload.profile ?? null;
		const relationRef = extractRelationRef(relationPayload);

		let volunteerProfileId = relationRef.id;
		if (volunteerProfileId <= 0 && relationRef.documentId) {
			const profileByDocumentId = await strapi.db
				.query("api::volunteer-profile.volunteer-profile")
				.findOne({
					where: { documentId: relationRef.documentId },
					select: ["id"]
				});
			volunteerProfileId = toId((profileByDocumentId as { id?: unknown })?.id);
		}

		if (volunteerProfileId <= 0) {
			return ctx.badRequest("Volunteer profile is required.");
		}

		const profileEntry = await strapi.db
			.query("api::volunteer-profile.volunteer-profile")
			.findOne({
				where: { id: volunteerProfileId },
				select: ["id"]
			});
		if (!profileEntry) {
			return ctx.notFound("Volunteer profile not found.");
		}

		const createdReview = await strapi.db
			.query("api::review-valonteer.review-valonteer")
			.create({
				data: {
					text,
					volunteer_profile: volunteerProfileId,
					publishedAt: new Date().toISOString()
				}
			});

		return ctx.send({
			ok: true,
			id: toId((createdReview as { id?: unknown })?.id)
		});
	}
}));
