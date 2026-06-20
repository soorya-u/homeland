import { env } from "@homeland/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import {
	account,
	accountRelations,
	casbinRule,
	entityUserAssociations,
	entityUserAssociationsRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./schema";

export function createDb() {
	return drizzle(env.DATABASE_URL, {
		schema: {
			account,
			accountRelations,
			casbinRule,
			entityUserAssociations,
			entityUserAssociationsRelations,
			session,
			sessionRelations,
			user,
			userRelations,
			verification,
		},
	});
}

export const db = createDb();
