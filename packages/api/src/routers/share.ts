import { getEntityMetadata } from "@homeland/db/modules";
import {
	createShare,
	deleteShare,
	getEntityShares,
} from "@homeland/db/repositories/entity";
import { ORPCError } from "@orpc/server";
import z from "zod";

import { authorizedProcedure } from "../index";

function getContainedEntities(
	_entityType: string,
	_entityId: string
): { type: string; id: string }[] {
	return [];
}

export const shareRouter = {
	share: authorizedProcedure
		.route({ method: "POST", path: "/shares", successStatus: 201 })
		.input(
			z.object({
				entityType: z.string().min(1),
				entityId: z.string().min(1),
				targetUserId: z.string().min(1),
				role: z.enum(["viewer", "editor"]),
			})
		)
		.handler(async ({ input, context }) => {
			const meta = getEntityMetadata(`${input.entityType}:read`);
			if (!meta?.shareRoles?.includes(input.role)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Entity type "${input.entityType}" cannot be shared as "${input.role}"`,
				});
			}

			const canShare = await context.authorize(`${input.entityType}:share`, {
				type: input.entityType,
				id: input.entityId,
				ownerId: context.session.user.id,
				isPublic: false,
			});
			if (!canShare) {
				throw new ORPCError("FORBIDDEN", {
					message: "Not authorized to share this entity",
				});
			}

			await createShare({
				entityType: input.entityType,
				entityId: input.entityId,
				userId: input.targetUserId,
				role: input.role,
				sharedBy: context.session.user.id,
			});

			const contained = getContainedEntities(input.entityType, input.entityId);
			for (const child of contained) {
				const childMeta = getEntityMetadata(`${child.type}:read`);
				const childRole = childMeta?.shareRoles?.includes("viewer")
					? "viewer"
					: null;
				if (childRole) {
					await createShare({
						entityType: child.type,
						entityId: child.id,
						userId: input.targetUserId,
						role: childRole,
						sharedBy: context.session.user.id,
					});
				}
			}

			return { success: true };
		}),

	unshare: authorizedProcedure
		.route({ method: "DELETE", path: "/shares", successStatus: 204 })
		.input(
			z.object({
				entityType: z.string().min(1),
				entityId: z.string().min(1),
				targetUserId: z.string().min(1),
			})
		)
		.handler(async ({ input, context }) => {
			const canShare = await context.authorize(`${input.entityType}:share`, {
				type: input.entityType,
				id: input.entityId,
				ownerId: context.session.user.id,
				isPublic: false,
			});
			if (!canShare) {
				throw new ORPCError("FORBIDDEN", {
					message: "Not authorized to unshare this entity",
				});
			}

			await deleteShare(input.entityType, input.entityId, input.targetUserId);

			return { success: true };
		}),

	list: authorizedProcedure
		.route({ method: "GET", path: "/shares" })
		.input(
			z.object({
				entityType: z.string().min(1),
				entityId: z.string().min(1),
			})
		)
		.handler(async ({ input, context }) => {
			const canRead = await context.authorize(`${input.entityType}:read`, {
				type: input.entityType,
				id: input.entityId,
				ownerId: context.session.user.id,
				isPublic: false,
			});
			if (!canRead) {
				throw new ORPCError("FORBIDDEN", {
					message: "Not authorized to view shares for this entity",
				});
			}

			const shares = await getEntityShares(input.entityType, input.entityId);

			return { shares };
		}),
};
