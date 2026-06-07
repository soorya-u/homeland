import { expo } from "@better-auth/expo";
import { createDb } from "@homeland/db";
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "@homeland/db/schema/auth";
import { env } from "@homeland/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				account,
				accountRelations,
				session,
				sessionRelations,
				user,
				userRelations,
				verification,
			},
		}),
		trustedOrigins: [
			env.CORS_ORIGIN,
			"http://localhost:5173",
			"dev.soorya-u.homeland://",
			"exp://",
			"http://localhost:8081",
		],
		emailAndPassword: {
			enabled: true,
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [expo()],
	});
}

export const auth = createAuth();
