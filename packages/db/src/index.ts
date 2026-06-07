import { env } from "@homeland/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import {
	account,
	accountRelations,
	session,
	sessionRelations,
	todo,
	user,
	userRelations,
	verification,
} from "./schema";

export function createDb() {
	return drizzle(env.DATABASE_URL, {
		schema: {
			account,
			accountRelations,
			session,
			sessionRelations,
			todo,
			user,
			userRelations,
			verification,
		},
	});
}

export const db = createDb();
