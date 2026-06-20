import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { Enforcer } from "casbin";

export function authorizationServerPlugin(enforcer: Enforcer) {
	return {
		id: "authorization",
		endpoints: {
			getPermissions: createAuthEndpoint(
				"/permissions",
				{ method: "GET", use: [sessionMiddleware] },
				async (ctx) => {
					const role = ctx.context.session.user.role as string;
					if (role === "admin") {
						return ctx.json({ permissions: ["*"], role });
					}
					const policies = await enforcer.getFilteredPolicy(
						0,
						ctx.context.session.user.id
					);
					const permissions = policies.map((p) => p[1]);
					return ctx.json({ permissions, role });
				}
			),
		},
	} satisfies BetterAuthPlugin;
}
