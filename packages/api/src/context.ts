import type { Auth, Enforcer } from "@homeland/auth";
import type { Context as ElysiaContext } from "elysia";

export interface CreateContextOptions {
	auth: Auth;
	context: ElysiaContext;
	enforcer: Enforcer;
}

export async function createContext({
	context,
	auth,
	enforcer,
}: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		session,
		enforcer,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
