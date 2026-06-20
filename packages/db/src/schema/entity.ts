import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const entityUserAssociations = pgTable(
	"entity_user_associations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		sharedBy: text("shared_by").references(() => user.id, {
			onDelete: "set null",
		}),
		sharedAt: timestamp("shared_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("entity_user_associations_unique").on(
			table.entityType,
			table.entityId,
			table.userId
		),
		index("entity_user_associations_entity_idx").on(
			table.entityType,
			table.entityId
		),
		index("entity_user_associations_user_idx").on(table.userId),
	]
);

export const entityUserAssociationsRelations = relations(
	entityUserAssociations,
	({ one }) => ({
		user: one(user, {
			fields: [entityUserAssociations.userId],
			references: [user.id],
		}),
		sharedByUser: one(user, {
			fields: [entityUserAssociations.sharedBy],
			references: [user.id],
		}),
	})
);
