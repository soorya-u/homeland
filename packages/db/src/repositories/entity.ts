import { and, eq } from "drizzle-orm";
import { db } from "..";
import { entityUserAssociations } from "../schema/entity";

export async function getEntityShares(entityType: string, entityId: string) {
	return await db.query.entityUserAssociations.findMany({
		where: and(
			eq(entityUserAssociations.entityType, entityType),
			eq(entityUserAssociations.entityId, entityId)
		),
	});
}

export async function createShare(data: {
	entityType: string;
	entityId: string;
	userId: string;
	role: string;
	sharedBy: string;
}) {
	await db.insert(entityUserAssociations).values(data).onConflictDoNothing();
}

export async function deleteShare(
	entityType: string,
	entityId: string,
	userId: string
) {
	await db
		.delete(entityUserAssociations)
		.where(
			and(
				eq(entityUserAssociations.entityType, entityType),
				eq(entityUserAssociations.entityId, entityId),
				eq(entityUserAssociations.userId, userId)
			)
		);
}
